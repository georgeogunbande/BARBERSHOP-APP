using BarbershopApi.Data;
using BarbershopApi.DTOs;
using BarbershopApi.Models.Bookings;
using BarbershopApi.Models.Enums;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BarbershopApi.Controllers;

[ApiController]
[Route("book")]
public class BookController(AppDbContext db) : ControllerBase
{
    [HttpGet("{handle}")]
    public async Task<IActionResult> GetPage(string handle)
    {
        var biz = await db.Businesses.FirstOrDefaultAsync(b => b.BookingHandle == handle && b.IsActive);
        if (biz == null) return NotFound();
        return Ok(new PublicBookingPageDto(biz.Id, biz.Name, biz.City, biz.LogoUrl, biz.CoverPhotoUrl, biz.ActiveTheme, biz.Currency));
    }

    [HttpGet("{handle}/services")]
    public async Task<IActionResult> GetServices(string handle)
    {
        var biz = await db.Businesses.FirstOrDefaultAsync(b => b.BookingHandle == handle && b.IsActive);
        if (biz == null) return NotFound();

        var services = await db.Services
            .Include(s => s.Category)
            .Where(s => s.BusinessId == biz.Id && s.Active)
            .OrderBy(s => s.SortOrder)
            .ToListAsync();

        return Ok(services.Select(s => new ServiceDto(s.Id, s.Name, s.Price, s.DurationMins, s.Category?.Name, s.Active, s.DepositPct, s.BookingCount, s.CreatedAt)));
    }

    [HttpGet("{handle}/staff")]
    public async Task<IActionResult> GetStaff(string handle)
    {
        var biz = await db.Businesses.FirstOrDefaultAsync(b => b.BookingHandle == handle && b.IsActive);
        if (biz == null) return NotFound();

        var staff = await db.StaffMembers
            .Where(s => s.BusinessId == biz.Id && s.IsActive)
            .ToListAsync();

        return Ok(staff.Select(s => new { s.Id, s.FirstName, s.LastName, s.AvatarUrl, s.Colour, s.ServiceIds }));
    }

    [HttpGet("{handle}/slots")]
    public async Task<IActionResult> GetSlots(string handle, [FromQuery] Guid serviceId, [FromQuery] Guid? staffMemberId, [FromQuery] DateTime date)
    {
        var biz = await db.Businesses.FirstOrDefaultAsync(b => b.BookingHandle == handle && b.IsActive);
        if (biz == null) return NotFound();

        var service = await db.Services.FirstOrDefaultAsync(s => s.Id == serviceId && s.BusinessId == biz.Id);
        if (service == null) return BadRequest();

        var fh = await db.FamilyHoursConfigs.FirstOrDefaultAsync(f => f.BusinessId == biz.Id);
        if (fh != null && fh.IsEnabled && fh.Days.Contains(date.DayOfWeek))
        {
            var now = TimeOnly.FromDateTime(date);
            if (now >= fh.StartTime && now <= fh.EndTime)
                return Ok(new { blockedByFamilyHours = true, message = fh.Message ?? "Booking not available during family hours.", suggestAlternative = true, slots = Array.Empty<object>() });
        }

        var staffQuery = db.StaffMembers.Include(s => s.Schedules).Where(s => s.BusinessId == biz.Id && s.IsActive);
        if (staffMemberId.HasValue) staffQuery = staffQuery.Where(s => s.Id == staffMemberId.Value);
        var staffList = await staffQuery.ToListAsync();

        var existingBookings = await db.Bookings
            .Where(b => b.BusinessId == biz.Id && b.StartsAt.Date == date.Date && b.Status != BookingStatus.Cancelled)
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
                    b.StaffMemberId == staff.Id && b.StartsAt < slotEnd && b.EndsAt > current);
                var isLocked = existingBookings.Any(b =>
                    b.StaffMemberId == staff.Id && b.SlotLockedUntil > DateTime.UtcNow &&
                    b.StartsAt < slotEnd && b.EndsAt > current);

                if (!isBooked && !isLocked)
                    slots.Add(new { staffId = staff.Id, staffName = staff.FullName, startsAt = current, endsAt = slotEnd });

                current = current.AddMinutes(service.DurationMins);
            }
        }
        return Ok(slots);
    }

    [HttpPost("{handle}/reserve")]
    public async Task<IActionResult> Reserve(string handle, [FromBody] ReserveSlotRequest req)
    {
        var biz = await db.Businesses.FirstOrDefaultAsync(b => b.BookingHandle == handle && b.IsActive);
        if (biz == null) return NotFound();

        var service = await db.Services.FirstOrDefaultAsync(s => s.Id == req.ServiceId && s.BusinessId == biz.Id);
        if (service == null) return BadRequest();

        var conflict = await db.Bookings.AnyAsync(b =>
            b.BusinessId == biz.Id && b.StaffMemberId == req.StaffMemberId &&
            b.Status != BookingStatus.Cancelled &&
            (b.SlotLockedUntil > DateTime.UtcNow || b.Status == BookingStatus.Confirmed) &&
            b.StartsAt < req.StartsAt.AddMinutes(service.DurationMins) && b.EndsAt > req.StartsAt);

        if (conflict)
            return Conflict(new { error = new { code = "SLOT_TAKEN", message = "That slot is no longer available.", status = 409 } });

        var client = await db.Clients.FirstOrDefaultAsync(c => c.BusinessId == biz.Id && c.Email == req.ClientEmail)
            ?? new Models.Clients.Client
            {
                BusinessId = biz.Id,
                FirstName = req.ClientFirstName,
                LastName = req.ClientLastName,
                Email = req.ClientEmail,
                Phone = req.ClientPhone
            };

        if (client.Id == Guid.Empty)
        {
            db.Clients.Add(client);
            await db.SaveChangesAsync();
        }

        var lockToken = Guid.NewGuid().ToString("N");
        var booking = new Booking
        {
            BusinessId = biz.Id,
            ClientId = client.Id,
            ServiceId = req.ServiceId,
            StaffMemberId = req.StaffMemberId,
            StartsAt = req.StartsAt,
            EndsAt = req.StartsAt.AddMinutes(service.DurationMins),
            Price = service.Price,
            DepositAmount = service.Price * service.DepositPct / 100,
            Status = BookingStatus.Pending,
            SlotLockToken = lockToken,
            SlotLockedUntil = DateTime.UtcNow.AddMinutes(10),
            IsPublicBooking = true
        };
        db.Bookings.Add(booking);
        await db.SaveChangesAsync();

        return Ok(new ReserveSlotResponse(lockToken, booking.SlotLockedUntil!.Value, booking.DepositAmount, booking.DepositAmount > 0));
    }

    [HttpPost("{handle}/confirm")]
    public async Task<IActionResult> Confirm(string handle, [FromBody] ConfirmBookingRequest req)
    {
        var biz = await db.Businesses.FirstOrDefaultAsync(b => b.BookingHandle == handle && b.IsActive);
        if (biz == null) return NotFound();

        var booking = await db.Bookings.FirstOrDefaultAsync(b => b.BusinessId == biz.Id && b.SlotLockToken == req.LockToken);
        if (booking == null || booking.SlotLockedUntil < DateTime.UtcNow)
            return BadRequest(new { error = new { code = "LOCK_EXPIRED", message = "Slot reservation has expired.", status = 400 } });

        booking.Status = BookingStatus.Confirmed;
        booking.SlotLockToken = null;
        booking.SlotLockedUntil = null;
        await db.SaveChangesAsync();
        // TODO: process deposit via Stripe if required

        return Ok(new { bookingId = booking.Id, message = "Booking confirmed!", startsAt = booking.StartsAt });
    }

    [HttpGet("{handle}/reviews")]
    public IActionResult GetReviews(string handle)
    {
        var reviews = new[]
        {
            new PublicReviewDto("Jordan M.", 5, "Best haircut in the city!", DateTime.UtcNow.AddDays(-5)),
            new PublicReviewDto("Alex T.", 5, "Professional and on time.", DateTime.UtcNow.AddDays(-12))
        };
        return Ok(reviews);
    }
}
