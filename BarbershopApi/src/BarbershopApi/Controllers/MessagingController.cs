using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using BarbershopApi.Data;
using BarbershopApi.DTOs;
using BarbershopApi.Models.Enums;
using BarbershopApi.Models.Messaging;
using BarbershopApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BarbershopApi.Controllers;

[ApiController]
[Route("messaging")]
[Authorize]
public class MessagingController(AppDbContext db, ITenantService tenant, IHttpClientFactory httpClientFactory, IConfiguration config) : ControllerBase
{
    // Rate limit: max 10 SMS per business per hour (in-memory; replace with Redis in prod)
    private static readonly Dictionary<Guid, (int Count, DateTime Window)> _smsRateLimit = [];
    private static readonly object _rateLock = new();

    private bool CheckSmsRateLimit(Guid bizId)
    {
        lock (_rateLock)
        {
            var now = DateTime.UtcNow;
            if (_smsRateLimit.TryGetValue(bizId, out var entry))
            {
                if (now - entry.Window > TimeSpan.FromHours(1))
                    _smsRateLimit[bizId] = (1, now);
                else if (entry.Count >= 10)
                    return false;
                else
                    _smsRateLimit[bizId] = (entry.Count + 1, entry.Window);
            }
            else _smsRateLimit[bizId] = (1, now);
            return true;
        }
    }

    private async Task<(string? Sid, string? Status, string? Error)> DispatchTwilioSms(string to, string body)
    {
        var sid = config["Twilio:AccountSid"];
        var token = config["Twilio:AuthToken"];
        var from = config["Twilio:PhoneNumber"];
        if (string.IsNullOrEmpty(sid) || string.IsNullOrEmpty(token) || string.IsNullOrEmpty(from))
            return (null, null, "Twilio credentials not configured");

        var http = httpClientFactory.CreateClient();
        var url = $"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json";
        var credentials = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{sid}:{token}"));
        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", credentials);

        var form = new FormUrlEncodedContent([
            new("To", to), new("From", from), new("Body", body)
        ]);

        var res = await http.PostAsync(url, form);
        var json = await res.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        if (!res.IsSuccessStatusCode)
            return (null, null, root.TryGetProperty("message", out var msg) ? msg.GetString() : "Twilio error");

        var messageSid = root.TryGetProperty("sid", out var sidProp) ? sidProp.GetString() : null;
        var status = root.TryGetProperty("status", out var statusProp) ? statusProp.GetString() : null;
        return (messageSid, status, null);
    }

    [HttpPost("sms/send")]
    [AllowAnonymous]
    public async Task<IActionResult> SendSmsDirect([FromBody] SendSmsDirectRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.To) || string.IsNullOrWhiteSpace(req.Body))
            return BadRequest(new { error = "to and body are required" });

        var phone = req.To.Trim();
        if (!System.Text.RegularExpressions.Regex.IsMatch(phone, @"^\+?[1-9]\d{7,14}$"))
            return BadRequest(new { error = "Invalid phone number format" });

        if (req.Body.Length > 160)
            return BadRequest(new { error = "Message must be 160 characters or less" });

        // Rate limit by business claim or fallback to IP
        var bizIdClaim = User.FindFirst("business_id")?.Value;
        Guid bizId = bizIdClaim != null ? Guid.Parse(bizIdClaim) : Guid.Empty;
        if (!CheckSmsRateLimit(bizId))
            return StatusCode(429, new { error = "Rate limit exceeded — max 10 SMS per hour" });

        var (sid, status, error) = await DispatchTwilioSms(phone, req.Body);
        if (error != null) return StatusCode(502, new { error });

        var log = new MessagingLog
        {
            BusinessId = bizId,
            Channel = MessageChannel.SMS,
            To = phone,
            Body = req.Body,
            ExternalMessageId = sid,
            DeliveryStatus = status ?? "queued"
        };
        db.MessagingLogs.Add(log);
        await db.SaveChangesAsync();

        return Ok(new { sid, status });
    }

    [HttpPost("sms")]
    public async Task<IActionResult> SendSms([FromBody] SendSmsRequest req)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var client = await db.Clients.FindAsync(req.ClientId);
        if (client == null) return NotFound();

        var log = new MessagingLog { BusinessId = bizId, ClientId = req.ClientId, Channel = MessageChannel.SMS, To = client.Phone, Body = req.Message };
        db.MessagingLogs.Add(log);
        await db.SaveChangesAsync();

        if (!string.IsNullOrEmpty(client.Phone))
            await DispatchTwilioSms(client.Phone, req.Message);

        return Ok(new { message = "SMS sent.", id = log.Id });
    }

    [HttpPost("email")]
    public async Task<IActionResult> SendEmail([FromBody] SendEmailRequest req)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var client = await db.Clients.FindAsync(req.ClientId);
        if (client == null) return NotFound();

        var log = new MessagingLog { BusinessId = bizId, ClientId = req.ClientId, Channel = MessageChannel.Email, To = client.Email, Body = req.Body };
        db.MessagingLogs.Add(log);
        await db.SaveChangesAsync();
        // TODO: dispatch via SendGrid
        return Ok(new { message = "Email sent.", id = log.Id });
    }

    [HttpPost("blast")]
    public async Task<IActionResult> Blast([FromBody] BlastRequest req)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        if (!tenant.IsOwnerOrManager()) return Forbid();

        var query = db.Clients.Where(c => c.BusinessId == bizId);
        if (req.Tags != null && req.Tags.Any()) query = query.Where(c => c.Tags.Any(t => req.Tags.Contains(t)));
        if (req.ChurnRisk.HasValue) query = query.Where(c => c.ChurnRisk == req.ChurnRisk.Value);

        var clients = await query.ToListAsync();
        var logs = clients.Where(c => c.Phone != null).Select(c => new MessagingLog
        {
            BusinessId = bizId,
            ClientId = c.Id,
            Channel = MessageChannel.SMS,
            To = c.Phone,
            Body = req.Message
        }).ToList();

        db.MessagingLogs.AddRange(logs);
        await db.SaveChangesAsync();
        // TODO: dispatch all via Twilio
        return Ok(new { message = $"Blast queued for {logs.Count} clients." });
    }

    [HttpGet("templates")]
    public async Task<IActionResult> GetTemplates()
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var templates = await db.MessageTemplates.Where(t => t.BusinessId == bizId).ToListAsync();
        return Ok(templates.Select(MapTemplate));
    }

    [HttpPost("templates")]
    public async Task<IActionResult> CreateTemplate([FromBody] CreateTemplateRequest req)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var template = new MessageTemplate { BusinessId = bizId, Name = req.Name, Subject = req.Subject, Body = req.Body, Channel = req.Channel };
        db.MessageTemplates.Add(template);
        await db.SaveChangesAsync();
        return Ok(MapTemplate(template));
    }

    [HttpPatch("templates/{id:guid}")]
    public async Task<IActionResult> UpdateTemplate(Guid id, [FromBody] UpdateTemplateRequest req)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var template = await db.MessageTemplates.FirstOrDefaultAsync(t => t.Id == id && t.BusinessId == bizId);
        if (template == null) return NotFound();
        if (req.Name != null) template.Name = req.Name;
        if (req.Subject != null) template.Subject = req.Subject;
        if (req.Body != null) template.Body = req.Body;
        if (req.IsActive.HasValue) template.IsActive = req.IsActive.Value;
        template.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(MapTemplate(template));
    }

    [HttpPost("webhooks/twilio")]
    [AllowAnonymous]
    public async Task<IActionResult> TwilioInbound([FromForm] string From, [FromForm] string Body, [FromForm] string? To)
    {
        var log = new MessagingLog { BusinessId = Guid.Empty, Channel = MessageChannel.SMS, To = To, Body = $"INBOUND from {From}: {Body}" };
        db.MessagingLogs.Add(log);
        await db.SaveChangesAsync();
        return Content("<Response></Response>", "application/xml");
    }

    [HttpPost("webhooks/twilio/status")]
    [AllowAnonymous]
    public async Task<IActionResult> TwilioDeliveryStatus(
        [FromForm] string MessageSid,
        [FromForm] string MessageStatus)
    {
        var log = await db.MessagingLogs.FirstOrDefaultAsync(m => m.ExternalMessageId == MessageSid);
        if (log != null)
        {
            log.DeliveryStatus = MessageStatus;
            log.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }
        return Ok();
    }

    [HttpPost("sms/register-10dlc")]
    public async Task<IActionResult> Register10Dlc([FromBody] Register10DlcRequest req)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        if (!tenant.IsOwnerOrManager()) return Forbid();

        var http = httpClientFactory.CreateClient();
        var sid = config["Twilio:AccountSid"];
        var token = config["Twilio:AuthToken"];
        if (string.IsNullOrEmpty(sid) || string.IsNullOrEmpty(token))
            return StatusCode(502, new { error = "Twilio credentials not configured" });

        var credentials = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{sid}:{token}"));
        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", credentials);

        // Step 1: Create a Brand
        var brandForm = new FormUrlEncodedContent([
            new("FriendlyName", req.LegalName),
            new("EntityType", "PRIVATE_PROFIT"),
            new("Ein", req.Ein),
            new("Phone", req.Phone ?? ""),
            new("Street", req.Street ?? ""),
            new("City", req.City ?? ""),
            new("State", req.State ?? ""),
            new("PostalCode", req.PostalCode ?? ""),
            new("Country", "CA"),
        ]);
        var brandRes = await http.PostAsync(
            $"https://messaging.twilio.com/v1/Services/{sid}/TrustHub/CustomerProfiles",
            brandForm);

        if (!brandRes.IsSuccessStatusCode)
            return StatusCode(502, new { error = "Brand registration failed — check Twilio credentials" });

        var brandJson = await brandRes.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(brandJson);
        var brandSid = doc.RootElement.TryGetProperty("sid", out var s) ? s.GetString() : null;

        return Ok(new { status = "pending", brandSid, message = "A2P 10DLC brand registration submitted. Approval typically takes 1–3 business days." });
    }

    [HttpPost("webhooks/email")]
    [AllowAnonymous]
    public async Task<IActionResult> EmailInbound([FromForm] string from, [FromForm] string text)
    {
        // TODO: validate SendGrid, route to AI Front Desk
        await Task.CompletedTask;
        return Ok();
    }

    private static MessageTemplateDto MapTemplate(MessageTemplate t) => new(t.Id, t.Name, t.Subject, t.Body, t.Channel, t.IsActive, t.CreatedAt);
}

[ApiController]
[Route("brief")]
[Authorize]
public class BriefController(AppDbContext db, ITenantService tenant) : ControllerBase
{
    [HttpGet("today")]
    public async Task<IActionResult> GetToday()
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var today = DateTime.UtcNow.Date;
        var bookings = await db.Bookings.Where(b => b.BusinessId == bizId && b.StartsAt.Date == today).ToListAsync();
        var revenue = bookings.Where(b => b.Status == Models.Enums.BookingStatus.Completed).Sum(b => b.Price);
        return Ok(new
        {
            date = today,
            appointmentsToday = bookings.Count,
            revenueTodayProjected = bookings.Sum(b => b.Price),
            revenueToday = revenue,
            pendingCount = bookings.Count(b => b.Status == Models.Enums.BookingStatus.Confirmed)
        });
    }

    [HttpGet("settings")]
    public async Task<IActionResult> GetSettings()
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var settings = await db.BriefSettings.FirstOrDefaultAsync(s => s.BusinessId == bizId)
            ?? new BriefSettings { BusinessId = bizId };
        return Ok(new BriefSettingsDto(settings.DeliveryTime, settings.Channels, settings.IsEnabled));
    }

    [HttpPatch("settings")]
    public async Task<IActionResult> UpdateSettings([FromBody] UpdateBriefSettingsRequest req)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var settings = await db.BriefSettings.FirstOrDefaultAsync(s => s.BusinessId == bizId);
        if (settings == null) { settings = new BriefSettings { BusinessId = bizId }; db.BriefSettings.Add(settings); }
        if (req.DeliveryTime.HasValue) settings.DeliveryTime = req.DeliveryTime.Value;
        if (req.Channels != null) settings.Channels = req.Channels;
        if (req.IsEnabled.HasValue) settings.IsEnabled = req.IsEnabled.Value;
        settings.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(new BriefSettingsDto(settings.DeliveryTime, settings.Channels, settings.IsEnabled));
    }

    [HttpPost("preview")]
    public IActionResult Preview() => Ok(new { message = "Test brief sent to your registered device." });
}
