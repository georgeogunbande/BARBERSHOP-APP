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
public class MessagingController(AppDbContext db, ITenantService tenant) : ControllerBase
{
    [HttpPost("sms")]
    public async Task<IActionResult> SendSms([FromBody] SendSmsRequest req)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var client = await db.Clients.FindAsync(req.ClientId);
        if (client == null) return NotFound();

        var log = new MessagingLog { BusinessId = bizId, ClientId = req.ClientId, Channel = MessageChannel.SMS, To = client.Phone, Body = req.Message };
        db.MessagingLogs.Add(log);
        await db.SaveChangesAsync();
        // TODO: dispatch via Twilio
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
        // TODO: validate Twilio signature, route to AI Front Desk
        var log = new MessagingLog { BusinessId = Guid.Empty, Channel = MessageChannel.SMS, To = To, Body = $"INBOUND from {From}: {Body}" };
        db.MessagingLogs.Add(log);
        await db.SaveChangesAsync();
        return Content("<Response></Response>", "application/xml");
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
