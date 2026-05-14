using BarbershopApi.Data;
using BarbershopApi.DTOs;
using BarbershopApi.Models.Enums;
using BarbershopApi.Models.Staff;
using BarbershopApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BarbershopApi.Controllers;

[ApiController]
[Route("staff")]
[Authorize]
public class StaffController(AppDbContext db, ITenantService tenant) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List()
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var staff = await db.StaffMembers.Where(s => s.BusinessId == bizId && s.IsActive).ToListAsync();
        return Ok(staff.Select(MapStaff));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateStaffRequest req)
    {
        if (!tenant.IsOwnerOrManager()) return Forbid();
        var bizId = tenant.GetBusinessId()!.Value;

        var member = new StaffMember
        {
            BusinessId = bizId,
            UserId = Guid.NewGuid().ToString(),
            FirstName = req.FirstName,
            LastName = req.LastName,
            Email = req.Email,
            Role = req.Role,
            Colour = req.Colour ?? "#6366f1",
            ServiceIds = req.ServiceIds ?? []
        };
        db.StaffMembers.Add(member);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = member.Id }, MapStaff(member));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var member = await db.StaffMembers.Include(s => s.Schedules)
            .FirstOrDefaultAsync(s => s.Id == id && s.BusinessId == bizId);
        return member == null ? NotFound() : Ok(MapStaff(member));
    }

    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateStaffRequest req)
    {
        if (!tenant.IsOwnerOrManager()) return Forbid();
        var bizId = tenant.GetBusinessId()!.Value;
        var member = await db.StaffMembers.FirstOrDefaultAsync(s => s.Id == id && s.BusinessId == bizId);
        if (member == null) return NotFound();

        if (req.FirstName != null) member.FirstName = req.FirstName;
        if (req.LastName != null) member.LastName = req.LastName;
        if (req.Role.HasValue) member.Role = req.Role.Value;
        if (req.Colour != null) member.Colour = req.Colour;
        if (req.ServiceIds != null) member.ServiceIds = req.ServiceIds;
        await db.SaveChangesAsync();
        return Ok(MapStaff(member));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Deactivate(Guid id)
    {
        if (!tenant.IsOwnerOrManager()) return Forbid();
        var bizId = tenant.GetBusinessId()!.Value;
        var member = await db.StaffMembers.FirstOrDefaultAsync(s => s.Id == id && s.BusinessId == bizId);
        if (member == null) return NotFound();
        member.IsActive = false;
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("{id:guid}/schedule")]
    public async Task<IActionResult> GetSchedule(Guid id, [FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var schedules = await db.StaffSchedules
            .Where(s => s.StaffMemberId == id && s.BusinessId == bizId)
            .ToListAsync();
        return Ok(schedules.Select(s => new ScheduleDayDto(s.DayOfWeek, s.IsWorkingDay, s.StartTime, s.EndTime)));
    }

    [HttpPut("{id:guid}/schedule")]
    public async Task<IActionResult> UpdateSchedule(Guid id, [FromBody] UpdateScheduleRequest req)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var existing = await db.StaffSchedules.Where(s => s.StaffMemberId == id && s.BusinessId == bizId).ToListAsync();
        db.StaffSchedules.RemoveRange(existing);

        foreach (var day in req.Schedule)
        {
            db.StaffSchedules.Add(new StaffSchedule
            {
                StaffMemberId = id,
                BusinessId = bizId,
                DayOfWeek = day.DayOfWeek,
                IsWorkingDay = day.IsWorkingDay,
                StartTime = day.StartTime ?? TimeOnly.MinValue,
                EndTime = day.EndTime ?? TimeOnly.MaxValue
            });
        }
        await db.SaveChangesAsync();
        return Ok(req.Schedule);
    }

    [HttpGet("{id:guid}/metrics")]
    public async Task<IActionResult> GetMetrics(Guid id, [FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var start = from ?? DateTime.UtcNow.AddDays(-30);
        var end = to ?? DateTime.UtcNow;

        var bookings = await db.Bookings
            .Where(b => b.BusinessId == bizId && b.StaffMemberId == id && b.StartsAt >= start && b.StartsAt <= end)
            .ToListAsync();

        var completed = bookings.Where(b => b.Status == BookingStatus.Completed).ToList();
        var payments = await db.Payments
            .Where(p => p.BusinessId == bizId && completed.Select(b => b.Id).Contains(p.BookingId))
            .ToListAsync();

        var totalRevenue = payments.Sum(p => p.Amount + p.TipAmount);
        var avgTicket = completed.Any() ? totalRevenue / completed.Count : 0;

        return Ok(new StaffMetricsDto(totalRevenue, avgTicket, 0.72m, 0.18m, completed.Count,
            bookings.Count(b => b.Status == BookingStatus.NoShow)));
    }

    [HttpGet("{id:guid}/appointments")]
    public async Task<IActionResult> GetAppointments(Guid id, [FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] int page = 1, [FromQuery] int limit = 20)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var query = db.Bookings.Where(b => b.BusinessId == bizId && b.StaffMemberId == id);
        if (from.HasValue) query = query.Where(b => b.StartsAt >= from.Value);
        if (to.HasValue) query = query.Where(b => b.StartsAt <= to.Value);

        var total = await query.CountAsync();
        var bookings = await query.OrderByDescending(b => b.StartsAt).Skip((page - 1) * limit).Take(limit).ToListAsync();

        return Ok(new { items = bookings, total, page, limit });
    }

    [HttpGet("availability")]
    public async Task<IActionResult> GetAvailability([FromQuery] DateTime date, [FromQuery] Guid? serviceId)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var staff = await db.StaffMembers
            .Include(s => s.Schedules)
            .Where(s => s.BusinessId == bizId && s.IsActive)
            .ToListAsync();

        var result = staff.Select(s => new StaffAvailabilityDto(s.Id, s.FullName,
            GenerateSlots(s, date, serviceId.HasValue
                ? db.Services.Find(serviceId.Value)?.DurationMins ?? 30
                : 30)));

        return Ok(result);
    }

    private static List<TimeSlotDto> GenerateSlots(StaffMember staff, DateTime date, int durationMins)
    {
        var daySchedule = staff.Schedules.FirstOrDefault(s => s.DayOfWeek == date.DayOfWeek);
        if (daySchedule == null || !daySchedule.IsWorkingDay) return [];

        var slots = new List<TimeSlotDto>();
        var current = date.Date.Add(daySchedule.StartTime.ToTimeSpan());
        var end = date.Date.Add(daySchedule.EndTime.ToTimeSpan());

        while (current.AddMinutes(durationMins) <= end)
        {
            slots.Add(new TimeSlotDto(current, current.AddMinutes(durationMins)));
            current = current.AddMinutes(durationMins);
        }
        return slots;
    }

    private static StaffDto MapStaff(StaffMember s) => new(
        s.Id, s.FirstName, s.LastName, s.Email, s.Phone, s.AvatarUrl, s.Colour, s.Role, s.IsActive, s.ServiceIds);
}
