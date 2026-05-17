using BarbershopApi.Data;
using BarbershopApi.DTOs;
using BarbershopApi.Models.Bookings;
using BarbershopApi.Models.Enums;
using static BarbershopApi.Models.Enums.DepositStatus;
using BarbershopApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BarbershopApi.Controllers;

[ApiController]
[Route("bookings")]
[Authorize]
public class BookingsController(AppDbContext db, ITenantService tenant) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] Guid? staffId,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 50)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var query = db.Bookings.Where(b => b.BusinessId == bizId);

        if (from.HasValue) query = query.Where(b => b.StartsAt >= from.Value);
        if (to.HasValue) query = query.Where(b => b.StartsAt <= to.Value);
        if (staffId.HasValue) query = query.Where(b => b.StaffMemberId == staffId.Value);

        var total = await query.CountAsync();
        var bookings = await query.OrderBy(b => b.StartsAt).Skip((page - 1) * limit).Take(limit).ToListAsync();
        return Ok(new { items = await EnrichBookingsAsync(bookings), total, page, limit });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateBookingRequest req)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var service = await db.Services.FindAsync(req.ServiceId);
        if (service == null) return BadRequest(Error("SERVICE_NOT_FOUND", "Service not found.", 400));

        var conflict = await db.Bookings.AnyAsync(b =>
            b.BusinessId == bizId &&
            b.StaffMemberId == req.StaffMemberId &&
            b.Status != BookingStatus.Cancelled &&
            b.StartsAt < req.StartsAt.AddMinutes(service.DurationMins) &&
            b.EndsAt > req.StartsAt);

        if (conflict) return Conflict(Error("BOOKING_CONFLICT", "That slot is no longer available.", 409));

        var booking = new Booking
        {
            BusinessId = bizId,
            ClientId = req.ClientId,
            ServiceId = req.ServiceId,
            StaffMemberId = req.StaffMemberId,
            StartsAt = req.StartsAt,
            EndsAt = req.StartsAt.AddMinutes(service.DurationMins),
            Price = service.Price,
            Notes = req.Notes,
            Status = BookingStatus.Confirmed
        };
        db.Bookings.Add(booking);
        service.BookingCount++;
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = booking.Id }, booking);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var booking = await db.Bookings.FirstOrDefaultAsync(b => b.Id == id && b.BusinessId == bizId);
        return booking == null ? NotFound() : Ok(booking);
    }

    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateBookingRequest req)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var booking = await db.Bookings.FirstOrDefaultAsync(b => b.Id == id && b.BusinessId == bizId);
        if (booking == null) return NotFound();

        if (req.StartsAt.HasValue)
        {
            var service = await db.Services.FindAsync(booking.ServiceId);
            booking.StartsAt = req.StartsAt.Value;
            booking.EndsAt = req.StartsAt.Value.AddMinutes(service?.DurationMins ?? 30);
        }
        if (req.StaffMemberId.HasValue) booking.StaffMemberId = req.StaffMemberId.Value;
        if (req.Notes != null) booking.Notes = req.Notes;
        booking.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        return Ok(booking);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Cancel(Guid id)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var booking = await db.Bookings.FirstOrDefaultAsync(b => b.Id == id && b.BusinessId == bizId);
        if (booking == null) return NotFound();

        booking.Status = BookingStatus.Cancelled;
        booking.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        // TODO: trigger cancellation_alert AutoPilot flow
        return NoContent();
    }

    [HttpPost("{id:guid}/complete")]
    public async Task<IActionResult> Complete(Guid id)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var booking = await db.Bookings.FirstOrDefaultAsync(b => b.Id == id && b.BusinessId == bizId);
        if (booking == null) return NotFound();

        booking.Status = BookingStatus.Completed;
        booking.UpdatedAt = DateTime.UtcNow;

        var client = await db.Clients.FindAsync(booking.ClientId);
        if (client != null)
        {
            client.LastVisitAt = booking.StartsAt;
            client.VisitCount++;
            client.NextVisitDueAt = booking.StartsAt.AddDays(client.RebookIntervalDays);
        }

        await db.SaveChangesAsync();
        // TODO: trigger review_request AutoPilot flow (24hr delay)
        return Ok(booking);
    }

    [HttpPost("{id:guid}/no-show")]
    public async Task<IActionResult> NoShow(Guid id)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var booking = await db.Bookings.FirstOrDefaultAsync(b => b.Id == id && b.BusinessId == bizId);
        if (booking == null) return NotFound();

        booking.Status = BookingStatus.NoShow;
        booking.UpdatedAt = DateTime.UtcNow;

        var client = await db.Clients.FindAsync(booking.ClientId);
        if (client != null) client.NoShowCount++;

        await db.SaveChangesAsync();
        return Ok(new { booking, clientNoShowCount = client?.NoShowCount ?? 0 });
    }

    [HttpPost("{id:guid}/deposit/interac")]
    public async Task<IActionResult> CreateInteracDeposit(Guid id)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var booking = await db.Bookings.FirstOrDefaultAsync(b => b.Id == id && b.BusinessId == bizId);
        if (booking == null) return NotFound();

        booking.InteracRefCode = $"FPF-{id.ToString()[..8].ToUpper()}";
        booking.DepositStatus = DepositStatus.PendingInterac;
        booking.SlotLockedUntil = DateTime.UtcNow.AddHours(2);
        booking.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return Ok(new { refCode = booking.InteracRefCode, lockedUntil = booking.SlotLockedUntil });
    }

    [HttpPatch("{id:guid}/deposit/confirm")]
    public async Task<IActionResult> ConfirmDeposit(Guid id)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var booking = await db.Bookings.FirstOrDefaultAsync(b => b.Id == id && b.BusinessId == bizId);
        if (booking == null) return NotFound();

        booking.DepositPaid = true;
        booking.DepositStatus = DepositStatus.Confirmed;
        booking.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(booking);
    }

    [HttpGet("slots")]
    public async Task<IActionResult> GetAvailableSlots([FromQuery] Guid serviceId, [FromQuery] Guid? staffMemberId, [FromQuery] DateTime date)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var service = await db.Services.FindAsync(serviceId);
        if (service == null) return BadRequest(Error("SERVICE_NOT_FOUND", "Service not found.", 400));

        var staffQuery = db.StaffMembers.Include(s => s.Schedules).Where(s => s.BusinessId == bizId && s.IsActive);
        if (staffMemberId.HasValue) staffQuery = staffQuery.Where(s => s.Id == staffMemberId.Value);
        var staffList = await staffQuery.ToListAsync();

        var existingBookings = await db.Bookings
            .Where(b => b.BusinessId == bizId && b.StartsAt.Date == date.Date && b.Status != BookingStatus.Cancelled)
            .ToListAsync();

        var slots = new List<object>();
        foreach (var staff in staffList)
        {
            var schedule = staff.Schedules.FirstOrDefault(s => s.DayOfWeek == date.DayOfWeek);
            if (schedule == null || !schedule.IsWorkingDay) continue;

            var current = date.Date.Add(schedule.StartTime.ToTimeSpan());
            var end = date.Date.Add(schedule.EndTime.ToTimeSpan());

            while (current.AddMinutes(service.DurationMins) <= end)
            {
                var slotEnd = current.AddMinutes(service.DurationMins);
                var isBooked = existingBookings.Any(b =>
                    b.StaffMemberId == staff.Id &&
                    b.StartsAt < slotEnd && b.EndsAt > current);

                if (!isBooked)
                    slots.Add(new { staffId = staff.Id, staffName = staff.FullName, startsAt = current, endsAt = slotEnd });

                current = current.AddMinutes(service.DurationMins);
            }
        }
        return Ok(slots);
    }

    [HttpGet("waitlist")]
    public async Task<IActionResult> GetWaitlist()
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var entries = await db.WaitlistEntries.Where(w => w.BusinessId == bizId).OrderBy(w => w.CreatedAt).ToListAsync();
        return Ok(entries);
    }

    [HttpPost("waitlist")]
    public async Task<IActionResult> AddToWaitlist([FromBody] AddToWaitlistRequest req)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var entry = new WaitlistEntry
        {
            BusinessId = bizId,
            ClientId = req.ClientId,
            ServiceId = req.ServiceId,
            PreferredStaffId = req.PreferredStaffId,
            PreferredDateStart = req.PreferredDateStart,
            PreferredDateEnd = req.PreferredDateEnd
        };
        db.WaitlistEntries.Add(entry);
        await db.SaveChangesAsync();
        return Ok(entry);
    }

    [HttpDelete("waitlist/{id:guid}")]
    public async Task<IActionResult> RemoveFromWaitlist(Guid id)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var entry = await db.WaitlistEntries.FirstOrDefaultAsync(w => w.Id == id && w.BusinessId == bizId);
        if (entry == null) return NotFound();
        db.WaitlistEntries.Remove(entry);
        await db.SaveChangesAsync();
        return NoContent();
    }

    private async Task<IEnumerable<object>> EnrichBookingsAsync(List<Booking> bookings)
    {
        var clientIds = bookings.Select(b => b.ClientId).Distinct().ToList();
        var clients = await db.Clients.Where(c => clientIds.Contains(c.Id)).ToDictionaryAsync(c => c.Id);
        var staffIds = bookings.Select(b => b.StaffMemberId).Distinct().ToList();
        var staff = await db.StaffMembers.Where(s => staffIds.Contains(s.Id)).ToDictionaryAsync(s => s.Id);
        var serviceIds = bookings.Select(b => b.ServiceId).Distinct().ToList();
        var services = await db.Services.IgnoreQueryFilters().Where(s => serviceIds.Contains(s.Id)).ToDictionaryAsync(s => s.Id);

        return bookings.Select(b => new BookingDto(
            b.Id,
            b.ClientId, clients.TryGetValue(b.ClientId, out var c) ? c.FullName : "Unknown",
            b.ServiceId, services.TryGetValue(b.ServiceId, out var svc) ? svc.Name : "Unknown",
            b.StaffMemberId, staff.TryGetValue(b.StaffMemberId, out var s) ? s.FullName : "Unknown",
            b.StartsAt, b.EndsAt, b.Status, b.Price, b.Notes, b.CreatedAt));
    }

    private static object Error(string code, string message, int status) => new
    {
        error = new { code, message, status, request_id = Guid.NewGuid().ToString() }
    };
}
