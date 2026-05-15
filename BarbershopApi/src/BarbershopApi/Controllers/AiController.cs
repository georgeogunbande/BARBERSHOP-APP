using BarbershopApi.Data;
using BarbershopApi.DTOs;
using BarbershopApi.Models.AI;
using BarbershopApi.Models.Enums;
using BarbershopApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BarbershopApi.Controllers;

[ApiController]
[Route("ai")]
[Authorize]
public class AiController(AppDbContext db, ITenantService tenant) : ControllerBase
{
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
        var client = await db.Clients.FirstOrDefaultAsync(c => c.Id == req.ClientId && c.BusinessId == bizId);
        if (client == null) return NotFound();

        var draft = $"Hey {client.FirstName}! We miss you at FlatPurse. It's been a while since your last visit. Book this week and enjoy 10% off your next service. Tap here to book: https://book.flatpurse.com";
        return Ok(new WinbackDraftDto(client.Id, client.FullName, draft));
    }

    [HttpPost("winback/send")]
    public async Task<IActionResult> SendWinback([FromBody] SendWinbackRequest req)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var client = await db.Clients.FirstOrDefaultAsync(c => c.Id == req.ClientId && c.BusinessId == bizId);
        if (client == null) return NotFound();

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
        // TODO: dispatch via Twilio
        return Ok(new { message = $"Win-back sent to {client.FullName}." });
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
