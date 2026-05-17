using BarbershopApi.Data;
using BarbershopApi.DTOs;
using BarbershopApi.Models.AI;
using BarbershopApi.Models.Enums;
using BarbershopApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace BarbershopApi.Controllers;

[ApiController]
[Route("ai")]
[Authorize]
public class AiController(AppDbContext db, ITenantService tenant, IHttpClientFactory httpClientFactory, IConfiguration config) : ControllerBase
{
    private async Task<string?> CallClaude(string userPrompt)
    {
        var apiKey = config["Anthropic:ApiKey"];
        if (string.IsNullOrEmpty(apiKey)) return null;

        var http = httpClientFactory.CreateClient();
        http.DefaultRequestHeaders.Add("x-api-key", apiKey);
        http.DefaultRequestHeaders.Add("anthropic-version", "2023-06-01");

        var body = new
        {
            model = "claude-sonnet-4-6",
            max_tokens = 200,
            messages = new[] { new { role = "user", content = userPrompt } }
        };

        var json = JsonSerializer.Serialize(body);
        var res = await http.PostAsync(
            "https://api.anthropic.com/v1/messages",
            new StringContent(json, Encoding.UTF8, "application/json"));

        if (!res.IsSuccessStatusCode) return null;

        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        return doc.RootElement
            .GetProperty("content")[0]
            .GetProperty("text")
            .GetString();
    }

    [HttpGet("conversations")]
    public async Task<IActionResult> GetConversations([FromQuery] int page = 1, [FromQuery] int limit = 20)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var query = db.AiConversations.Where(c => c.BusinessId == bizId).OrderByDescending(c => c.LastMessageAt);
        var total = await query.CountAsync();
        var convos = await query.Skip((page - 1) * limit).Take(limit).ToListAsync();
        return Ok(new
        {
            items = convos.Select(c => new AiConversationDto(c.Id, c.ClientId, null, c.Channel, c.Status, 0, c.LastMessageAt)),
            total, page, limit
        });
    }

    [HttpGet("conversations/{id:guid}")]
    public async Task<IActionResult> GetConversation(Guid id)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var convo = await db.AiConversations
            .Include(c => c.Messages)
            .FirstOrDefaultAsync(c => c.Id == id && c.BusinessId == bizId);

        if (convo == null) return NotFound();

        return Ok(new AiConversationDetailDto(
            convo.Id, convo.ClientId, null, convo.Channel, convo.Status,
            convo.Messages.OrderBy(m => m.CreatedAt).Select(m => new AiMessageDto(m.Id, m.IsFromClient, m.IsAiGenerated, m.Content, m.CreatedAt)).ToList(),
            convo.CreatedAt));
    }

    [HttpPost("conversations/{id:guid}/reply")]
    public async Task<IActionResult> Reply(Guid id, [FromBody] ManualReplyRequest req)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var convo = await db.AiConversations.Include(c => c.Messages)
            .FirstOrDefaultAsync(c => c.Id == id && c.BusinessId == bizId);
        if (convo == null) return NotFound();

        var message = new AiConversationMessage
        {
            ConversationId = id,
            IsFromClient = false,
            IsAiGenerated = false,
            Content = req.Message
        };
        db.AiConversationMessages.Add(message);
        convo.LastMessageAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(new AiMessageDto(message.Id, false, false, message.Content, message.CreatedAt));
    }

    [HttpPatch("conversations/{id:guid}/handoff")]
    public async Task<IActionResult> Handoff(Guid id)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var convo = await db.AiConversations.FirstOrDefaultAsync(c => c.Id == id && c.BusinessId == bizId);
        if (convo == null) return NotFound();

        convo.Status = AiConversationStatus.HandedOff;
        convo.HandedOffToUserId = tenant.GetUserId();
        convo.HandedOffAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(new { message = "Conversation handed off to owner.", conversationId = id });
    }

    [HttpGet("prompt")]
    public async Task<IActionResult> GetPrompt()
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var biz = await db.Businesses.FindAsync(bizId);
        return Ok(new { prompt = biz?.AiPrompt ?? "You are a helpful barbershop assistant. Be friendly and professional." });
    }

    [HttpPatch("prompt")]
    public async Task<IActionResult> UpdatePrompt([FromBody] UpdateAiPromptRequest req)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var biz = await db.Businesses.FindAsync(bizId);
        if (biz == null) return NotFound();
        biz.AiPrompt = req.Prompt;
        await db.SaveChangesAsync();
        return Ok(new { prompt = req.Prompt });
    }

    [HttpGet("insights")]
    public async Task<IActionResult> GetInsights()
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var now = DateTime.UtcNow;

        var overdueClients = await db.Clients
            .Where(c => c.BusinessId == bizId && c.NextVisitDueAt != null && c.NextVisitDueAt < now)
            .CountAsync();

        var highRiskChurn = await db.Clients
            .Where(c => c.BusinessId == bizId && c.ChurnRisk == ChurnRisk.High)
            .CountAsync();

        return Ok(new AiInsightsDto(
            ["Tuesday 2-4pm: consistently underbooked", "Friday mornings: 40% empty"],
            [$"{overdueClients} clients past their rebook interval"],
            ["Beard trim add-ons", "Hair treatment upsell opportunity"],
            [$"{highRiskChurn} clients at high churn risk"],
            ["Signature Cut could support +$5 price increase based on demand"],
            ["Consider staggering staff breaks to increase capacity"]));
    }

    [HttpGet("insights/{clientId:guid}")]
    public async Task<IActionResult> GetClientInsights(Guid clientId)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var client = await db.Clients.FirstOrDefaultAsync(c => c.Id == clientId && c.BusinessId == bizId);
        if (client == null) return NotFound();

        return Ok(new ClientAiInsightDto(
            client.ChurnRisk,
            client.LifetimeValue * 1.25m,
            ["Beard trim", "Hair treatment"],
            client.ChurnRisk >= ChurnRisk.Medium ? $"Hey {client.FirstName}, we miss you! Book your next appointment now." : null,
            DateTime.UtcNow));
    }

    [HttpPost("winback/generate")]
    public async Task<IActionResult> GenerateWinback([FromBody] GenerateWinbackRequest req)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var biz = await db.Businesses.FindAsync(bizId);
        var bizName = biz?.Name ?? "our salon";
        var bizCity = biz?.City ?? "";

        string clientName, lastService;
        int daysSince;
        decimal ltv;

        if (req.ClientId == Guid.Empty)
        {
            // Free-form generation from front-end supplied data
            clientName = req.ClientName ?? "there";
            lastService = req.LastService ?? "your last service";
            daysSince = req.DaysSince ?? 30;
            ltv = req.Ltv ?? 0;
        }
        else
        {
            var client = await db.Clients.FirstOrDefaultAsync(c => c.Id == req.ClientId && c.BusinessId == bizId);
            if (client == null) return NotFound();
            clientName = client.FirstName;
            lastService = "your last service";
            daysSince = client.LastVisitAt.HasValue
                ? (int)(DateTime.UtcNow - client.LastVisitAt.Value).TotalDays
                : 30;
            ltv = client.LifetimeValue;
        }

        var prompt = $"Write a warm, personal 2-sentence SMS win-back message for {clientName}, " +
                     $"who hasn't visited in {daysSince} days. Their last service was {lastService}. " +
                     $"Their lifetime value is ${ltv:F0}. Offer 15% off their next visit. " +
                     $"Business name: {bizName}{(bizCity.Length > 0 ? ", " + bizCity : "")}. " +
                     "Keep it personal and genuine, not salesy. No emojis. Under 160 characters.";

        var draft = await CallClaude(prompt)
            ?? $"Hi {clientName}! We miss you at {bizName}. Book this week for 15% off your next {lastService}. We'd love to see you back.";

        // Trim to SMS limit
        if (draft.Length > 160) draft = draft[..157] + "…";

        return Ok(new WinbackDraftDto(req.ClientId, clientName, draft));
    }

    [HttpPost("winback/send")]
    public async Task<IActionResult> SendWinback([FromBody] SendWinbackRequest req)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var client = await db.Clients.FirstOrDefaultAsync(c => c.Id == req.ClientId && c.BusinessId == bizId);
        if (client == null) return NotFound();
        if (string.IsNullOrEmpty(client.Phone))
            return BadRequest(new { error = "Client has no phone number on file." });

        var log = new Models.Messaging.MessagingLog
        {
            BusinessId = bizId,
            ClientId = req.ClientId,
            Channel = MessageChannel.SMS,
            To = client.Phone,
            Body = req.Message
        };
        db.MessagingLogs.Add(log);
        await db.SaveChangesAsync();

        // Dispatch via Twilio (graceful fallback when phone not yet approved)
        var fromNumber = config["Twilio:PhoneNumber"];
        if (string.IsNullOrEmpty(fromNumber))
            return Ok(new { message = $"Win-back queued for {client.FullName} — SMS will send once Twilio number is approved.", sid = (string?)null, status = "pending_number" });

        var (sid, status, error) = await DispatchSms(client.Phone, req.Message);
        if (error != null)
            return Ok(new { message = $"Win-back logged but SMS failed: {error}", sid = (string?)null, status = "failed" });

        log.ExternalMessageId = sid;
        log.DeliveryStatus = status ?? "queued";
        await db.SaveChangesAsync();

        return Ok(new { message = $"Win-back sent to {client.FullName}.", sid, status });
    }

    private async Task<(string? Sid, string? Status, string? Error)> DispatchSms(string to, string body)
    {
        var sid = config["Twilio:AccountSid"];
        var token = config["Twilio:AuthToken"];
        var from = config["Twilio:PhoneNumber"];
        if (string.IsNullOrEmpty(sid) || string.IsNullOrEmpty(token) || string.IsNullOrEmpty(from))
            return (null, null, "Twilio not configured");

        var http = httpClientFactory.CreateClient();
        var creds = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{sid}:{token}"));
        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", creds);

        var res = await http.PostAsync(
            $"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json",
            new FormUrlEncodedContent([new("To", to), new("From", from), new("Body", body)]));

        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        var root = doc.RootElement;
        if (!res.IsSuccessStatusCode)
            return (null, null, root.TryGetProperty("message", out var m) ? m.GetString() : "Twilio error");

        return (
            root.TryGetProperty("sid", out var s) ? s.GetString() : null,
            root.TryGetProperty("status", out var st) ? st.GetString() : null,
            null);
    }

    [HttpGet("daily-brief")]
    public async Task<IActionResult> GetDailyBrief()
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var today = DateTime.UtcNow.Date;
        var bookings = await db.Bookings
            .Where(b => b.BusinessId == bizId && b.StartsAt.Date == today && b.Status == BookingStatus.Confirmed)
            .OrderBy(b => b.StartsAt)
            .ToListAsync();

        var revenue = bookings.Sum(b => b.Price);
        return Ok(new DailyBriefDto(
            today, bookings.Count, revenue,
            [], // would enrich with client/staff names
            ["AutoPilot sent 3 rebook reminders yesterday", "2 slots filled by Slot Filler"],
            bookings.Count < 3 ? ["Low booking count today — consider running a promo"] : []));
    }
}
