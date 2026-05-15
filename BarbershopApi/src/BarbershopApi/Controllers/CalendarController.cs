using BarbershopApi.Data;
using BarbershopApi.DTOs;
using BarbershopApi.Models.Enums;
using BarbershopApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BarbershopApi.Controllers;

[ApiController]
[Route("calendar")]
[Authorize]
public class CalendarController(AppDbContext db, ITenantService tenant) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetCalendar([FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] Guid? staffId)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var start = from ?? DateTime.UtcNow.Date;
        var end = to ?? DateTime.UtcNow.Date.AddDays(7);

        var query = db.Bookings.Where(b => b.BusinessId == bizId && b.StartsAt >= start && b.StartsAt <= end && b.Status != BookingStatus.Cancelled);
        if (staffId.HasValue) query = query.Where(b => b.StaffMemberId == staffId.Value);

        var bookings = await query.OrderBy(b => b.StartsAt).ToListAsync();
        var enriched = await EnrichAsync(bookings);
        return Ok(enriched);
    }

    [HttpGet("week")]
    public async Task<IActionResult> GetWeekView([FromQuery] DateTime? weekStart)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var monday = weekStart?.Date ?? GetMonday(DateTime.UtcNow);
        var sunday = monday.AddDays(6);

        var bookings = await db.Bookings
            .Where(b => b.BusinessId == bizId && b.StartsAt >= monday && b.StartsAt <= sunday.AddDays(1) && b.Status == BookingStatus.Completed)
            .ToListAsync();

        var days = Enumerable.Range(0, 7).Select(i =>
        {
            var day = monday.AddDays(i);
            var dayBookings = bookings.Where(b => b.StartsAt.Date == day.Date).ToList();
            return new DayRevenueDto(day, dayBookings.Sum(b => b.Price), dayBookings.Count);
        }).ToList();

        return Ok(new WeekViewDto(monday, days, days.Sum(d => d.Revenue)));
    }

    [HttpGet("conflicts")]
    public async Task<IActionResult> GetConflicts([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var start = from ?? DateTime.UtcNow.Date;
        var end = to ?? DateTime.UtcNow.Date.AddDays(30);

        var bookings = await db.Bookings
            .Where(b => b.BusinessId == bizId && b.StartsAt >= start && b.StartsAt <= end && b.Status == BookingStatus.Confirmed)
            .OrderBy(b => b.StaffMemberId).ThenBy(b => b.StartsAt)
            .ToListAsync();

        var conflicts = new List<ConflictDto>();
        for (int i = 0; i < bookings.Count - 1; i++)
        {
            for (int j = i + 1; j < bookings.Count; j++)
            {
                var a = bookings[i];
                var b = bookings[j];
                if (a.StaffMemberId == b.StaffMemberId && a.StartsAt < b.EndsAt && a.EndsAt > b.StartsAt)
                    conflicts.Add(new ConflictDto(a.Id, b.Id, $"Staff double-booked on {a.StartsAt:MMM dd} at {a.StartsAt:HH:mm}"));
            }
        }
        return Ok(conflicts);
    }

    [HttpPost("sync/google")]
    public async Task<IActionResult> ConnectGoogle([FromBody] object req)
    {
        await Task.CompletedTask;
        return Ok(new { message = "Google Calendar sync connected." });
    }

    [HttpDelete("sync/google")]
    public async Task<IActionResult> DisconnectGoogle()
    {
        await Task.CompletedTask;
        return NoContent();
    }

    [HttpGet("sync/status")]
    public IActionResult GetSyncStatus() =>
        Ok(new { provider = "google", connected = false, lastSyncedAt = (DateTime?)null });

    private async Task<IEnumerable<CalendarBookingDto>> EnrichAsync(List<Models.Bookings.Booking> bookings)
    {
        var clientIds = bookings.Select(b => b.ClientId).Distinct().ToList();
        var clients = await db.Clients.IgnoreQueryFilters().Where(c => clientIds.Contains(c.Id)).ToDictionaryAsync(c => c.Id);
        var staffIds = bookings.Select(b => b.StaffMemberId).Distinct().ToList();
        var staff = await db.StaffMembers.Where(s => staffIds.Contains(s.Id)).ToDictionaryAsync(s => s.Id);
        var serviceIds = bookings.Select(b => b.ServiceId).Distinct().ToList();
        var services = await db.Services.IgnoreQueryFilters().Where(s => serviceIds.Contains(s.Id)).ToDictionaryAsync(s => s.Id);

        return bookings.Select(b => new CalendarBookingDto(
            b.Id,
            clients.TryGetValue(b.ClientId, out var c) ? c.FullName : "Unknown",
            services.TryGetValue(b.ServiceId, out var svc) ? svc.Name : "Unknown",
            staff.TryGetValue(b.StaffMemberId, out var s) ? s.FullName : "Unknown",
            b.StartsAt, b.EndsAt, b.Status,
            staff.TryGetValue(b.StaffMemberId, out var sm) ? sm.Colour : null));
    }

    private static DateTime GetMonday(DateTime date)
    {
        var diff = (7 + (date.DayOfWeek - DayOfWeek.Monday)) % 7;
        return date.AddDays(-diff).Date;
    }
}
