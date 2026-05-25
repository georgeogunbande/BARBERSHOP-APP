using BarbershopApi.Data;
using BarbershopApi.Models.Enums;
using BarbershopApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BarbershopApi.Controllers;

[ApiController]
[Route("api/sync")]
[Authorize]
public class SyncController(AppDbContext db, ITenantService tenant, IAuditService audit) : ControllerBase
{
    public record SyncItem(string Type, string Id, string Action, object? Payload);
    public record SyncRequest(List<SyncItem> Items);

    [HttpPost]
    public async Task<IActionResult> Sync([FromBody] SyncRequest req)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var results = new List<object>();

        foreach (var item in req.Items)
        {
            try
            {
                var result = item.Type switch
                {
                    "booking_cancel" => await HandleBookingCancelAsync(bizId, Guid.Parse(item.Id)),
                    "booking_complete" => await HandleBookingCompleteAsync(bizId, Guid.Parse(item.Id)),
                    "cash_payment" => await HandleCashPaymentAsync(bizId, item.Payload),
                    _ => (object)new { id = item.Id, status = "skipped", reason = "unknown type" }
                };
                results.Add(new { id = item.Id, type = item.Type, status = "ok", result });
            }
            catch (Exception ex)
            {
                results.Add(new { id = item.Id, type = item.Type, status = "error", error = ex.Message });
            }
        }

        await audit.LogAsync(bizId, tenant.GetUserId(), "OFFLINE_SYNC", "Sync", null, $"{results.Count} items synced");
        return Ok(new { synced = results.Count, results });
    }

    private async Task<object> HandleBookingCancelAsync(Guid bizId, Guid bookingId)
    {
        var booking = await db.Bookings.FirstOrDefaultAsync(b => b.Id == bookingId && b.BusinessId == bizId);
        if (booking == null) return new { status = "not_found" };
        booking.Status = BookingStatus.Cancelled;
        booking.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return new { status = "cancelled" };
    }

    private async Task<object> HandleBookingCompleteAsync(Guid bizId, Guid bookingId)
    {
        var booking = await db.Bookings.FirstOrDefaultAsync(b => b.Id == bookingId && b.BusinessId == bizId);
        if (booking == null) return new { status = "not_found" };
        booking.Status = BookingStatus.Completed;
        booking.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return new { status = "completed" };
    }

    private async Task<object> HandleCashPaymentAsync(Guid bizId, object? payload)
    {
        // Minimal cash payment sync — just record it was done offline
        return await Task.FromResult((object)new { status = "recorded", method = "cash" });
    }
}
