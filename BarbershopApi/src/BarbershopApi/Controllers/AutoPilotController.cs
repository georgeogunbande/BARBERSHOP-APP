using BarbershopApi.Data;
using BarbershopApi.DTOs;
using BarbershopApi.Models.AutoPilot;
using BarbershopApi.Models.Enums;
using BarbershopApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BarbershopApi.Controllers;

[ApiController]
[Route("autopilot")]
[Authorize]
public class AutoPilotController(AppDbContext db, ITenantService tenant) : ControllerBase
{
    private static readonly FlowStatusDto[] AllFlows =
    [
        new(AutoPilotFlowId.RebookReminder, "Rebook Reminder", "Nudges clients nearing their next visit interval.", true, "Client nearing next visit", "Send SMS/email rebooking nudge"),
        new(AutoPilotFlowId.SlotFiller, "Slot Filler", "Fills cancelled slots automatically.", true, "Appointment cancelled", "SMS waitlist clients"),
        new(AutoPilotFlowId.Winback, "Win-Back", "Re-engages inactive clients.", true, "Client inactive 30+ days", "AI-generated personalised SMS"),
        new(AutoPilotFlowId.NoShowRecovery, "No-Show Recovery", "Recovers revenue from no-shows.", true, "Client marked no-show", "Send reschedule offer + deposit link"),
        new(AutoPilotFlowId.BirthdayOffer, "Birthday Offer", "Sends birthday promotions.", true, "Client birthday within 7 days", "Send birthday promo code"),
        new(AutoPilotFlowId.UpsellPrompt, "Upsell Prompt", "Suggests add-on services.", true, "Client books single service", "Suggest complementary add-on"),
        new(AutoPilotFlowId.ReviewRequest, "Review Request", "Requests reviews after appointments.", true, "Appointment marked complete", "24hr delay → SMS review request"),
        new(AutoPilotFlowId.FamilyHours, "Family Hours", "Protects family time windows.", true, "Booking attempted in family window", "Block booking + suggest alt time"),
        new(AutoPilotFlowId.CancellationAlert, "Cancellation Alert", "Notifies owner of cancellations.", true, "Booking cancelled by client", "Notify owner + trigger slot filler"),
        new(AutoPilotFlowId.ChurnAlert, "Churn Alert", "Alerts when churn risk rises.", true, "Churn risk crosses threshold", "Notify owner + prepare win-back"),
    ];

    [HttpGet]
    public async Task<IActionResult> GetStatus()
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var configs = await db.AutoPilotFlowConfigs.Where(c => c.BusinessId == bizId).ToListAsync();
        var flows = AllFlows.Select(f =>
        {
            var cfg = configs.FirstOrDefault(c => c.FlowId == f.FlowId);
            return f with { IsEnabled = cfg?.IsEnabled ?? true };
        }).ToList();
        var globallyEnabled = flows.Any(f => f.IsEnabled);
        return Ok(new AutoPilotStatusDto(globallyEnabled, flows));
    }

    [HttpPatch]
    public async Task<IActionResult> UpdateGlobal([FromBody] UpdateAutoPilotGlobalRequest req)
    {
        if (!tenant.IsOwnerOrManager()) return Forbid();
        var bizId = tenant.GetBusinessId()!.Value;
        var configs = await db.AutoPilotFlowConfigs.Where(c => c.BusinessId == bizId).ToListAsync();

        foreach (var flow in Enum.GetValues<AutoPilotFlowId>())
        {
            var cfg = configs.FirstOrDefault(c => c.FlowId == flow);
            if (cfg == null) { db.AutoPilotFlowConfigs.Add(new AutoPilotFlowConfig { BusinessId = bizId, FlowId = flow, IsEnabled = req.GloballyEnabled }); }
            else { cfg.IsEnabled = req.GloballyEnabled; cfg.UpdatedAt = DateTime.UtcNow; }
        }
        await db.SaveChangesAsync();
        return Ok(new { globallyEnabled = req.GloballyEnabled });
    }

    [HttpGet("flows")]
    public async Task<IActionResult> GetFlows()
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var configs = await db.AutoPilotFlowConfigs.Where(c => c.BusinessId == bizId).ToListAsync();
        var flows = AllFlows.Select(f =>
        {
            var cfg = configs.FirstOrDefault(c => c.FlowId == f.FlowId);
            return f with { IsEnabled = cfg?.IsEnabled ?? true };
        });
        return Ok(flows);
    }

    [HttpPatch("flows/{flowId}")]
    public async Task<IActionResult> UpdateFlow(string flowId, [FromBody] UpdateFlowRequest req)
    {
        if (!tenant.IsOwnerOrManager()) return Forbid();
        if (!Enum.TryParse<AutoPilotFlowId>(flowId, true, out var flowEnum))
            return BadRequest(new { error = new { code = "INVALID_FLOW", message = "Unknown flow ID.", status = 400 } });

        var bizId = tenant.GetBusinessId()!.Value;
        var cfg = await db.AutoPilotFlowConfigs.FirstOrDefaultAsync(c => c.BusinessId == bizId && c.FlowId == flowEnum);
        if (cfg == null)
        {
            cfg = new AutoPilotFlowConfig { BusinessId = bizId, FlowId = flowEnum };
            db.AutoPilotFlowConfigs.Add(cfg);
        }
        cfg.IsEnabled = req.IsEnabled;
        cfg.CustomSettings = req.CustomSettings;
        cfg.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(cfg);
    }

    [HttpGet("events")]
    public async Task<IActionResult> GetEvents([FromQuery] int page = 1, [FromQuery] int limit = 50)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var query = db.AutoPilotEvents.Where(e => e.BusinessId == bizId).OrderByDescending(e => e.CreatedAt);
        var total = await query.CountAsync();
        var events = await query.Skip((page - 1) * limit).Take(limit).ToListAsync();
        return Ok(new { items = events.Select(e => new AutoPilotEventDto(e.Id, e.FlowId, e.FlowId.ToString(), e.ClientId, null, e.Description, e.WasSuccessful, e.RevenueRecovered, e.CreatedAt)), total, page, limit });
    }

    [HttpGet("revenue")]
    public async Task<IActionResult> GetRevenue()
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var total = await db.AutoPilotEvents.Where(e => e.BusinessId == bizId && e.WasSuccessful).SumAsync(e => (decimal?)(e.RevenueRecovered ?? 0)) ?? 0;
        return Ok(new { totalRevenueRecovered = total, currency = "CAD" });
    }

    [HttpGet("stats")]
    public async Task<IActionResult> GetStats()
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var events = await db.AutoPilotEvents.Where(e => e.BusinessId == bizId).ToListAsync();
        return Ok(new AutoPilotStatsDto(
            events.Count(e => e.FlowId == AutoPilotFlowId.SlotFiller && e.WasSuccessful),
            events.Count,
            events.Count(e => e.FlowId == AutoPilotFlowId.Winback && e.WasSuccessful),
            events.Count(e => e.FlowId == AutoPilotFlowId.ReviewRequest && e.WasSuccessful),
            events.Count(e => e.FlowId == AutoPilotFlowId.NoShowRecovery && e.WasSuccessful),
            events.Sum(e => e.RevenueRecovered ?? 0)));
    }
}
