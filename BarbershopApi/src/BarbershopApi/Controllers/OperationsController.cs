using BarbershopApi.Data;
using BarbershopApi.DTOs;
using BarbershopApi.Models.Enums;
using BarbershopApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BarbershopApi.Controllers;

[ApiController]
[Route("operations")]
[Authorize]
public class OperationsController(AppDbContext db, ITenantService tenant) : ControllerBase
{
    [HttpGet("score")]
    public async Task<IActionResult> GetScore()
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var last30Days = DateTime.UtcNow.AddDays(-30);

        var totalSlots = await db.StaffSchedules.Where(s => s.BusinessId == bizId && s.IsWorkingDay).CountAsync() * 8;
        var bookedSlots = await db.Bookings.Where(b => b.BusinessId == bizId && b.StartsAt >= last30Days && b.Status != BookingStatus.Cancelled).CountAsync();
        var utilization = totalSlots > 0 ? (decimal)bookedSlots / totalSlots * 100 : 0;

        var completedBookings = await db.Bookings.CountAsync(b => b.BusinessId == bizId && b.StartsAt >= last30Days && b.Status == BookingStatus.Completed);
        var totalBookings = await db.Bookings.CountAsync(b => b.BusinessId == bizId && b.StartsAt >= last30Days && b.Status != BookingStatus.Cancelled);
        var retentionScore = totalBookings > 0 ? (decimal)completedBookings / totalBookings * 100 : 0;

        var revenue = await db.Payments.Where(p => p.BusinessId == bizId && p.CreatedAt >= last30Days && p.Status == PaymentStatus.Succeeded).SumAsync(p => (decimal?)p.Amount) ?? 0;
        var revenueScore = Math.Min(100, revenue / 100);

        var autoPilotEvents = await db.AutoPilotEvents.CountAsync(e => e.BusinessId == bizId && e.CreatedAt >= last30Days && e.WasSuccessful);
        var autoPilotScore = Math.Min(100, autoPilotEvents * 10);

        var overall = (int)((utilization + retentionScore + revenueScore + autoPilotScore) / 4);
        return Ok(new OperationsScoreDto(overall, (int)utilization, (int)retentionScore, (int)revenueScore, (int)autoPilotScore));
    }

    [HttpGet("utilization")]
    public async Task<IActionResult> GetUtilization([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var start = from ?? DateTime.UtcNow.AddDays(-30);
        var end = to ?? DateTime.UtcNow;

        var staff = await db.StaffMembers.Where(s => s.BusinessId == bizId && s.IsActive).ToListAsync();
        var bookings = await db.Bookings.Where(b => b.BusinessId == bizId && b.StartsAt >= start && b.StartsAt <= end && b.Status != BookingStatus.Cancelled).ToListAsync();

        var byStaff = staff.Select(s =>
        {
            var staffBookings = bookings.Count(b => b.StaffMemberId == s.Id);
            var totalSlots = (int)((end - start).TotalDays) * 8;
            return new StaffUtilizationDto(s.Id, s.FullName, totalSlots > 0 ? (decimal)staffBookings / totalSlots : 0, staffBookings, totalSlots);
        }).ToList();

        var overall = byStaff.Any() ? byStaff.Average(s => s.Utilization) : 0;
        return Ok(new UtilizationDto(overall, byStaff));
    }

    [HttpGet("revenue")]
    public async Task<IActionResult> GetRevenue([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var start = from ?? DateTime.UtcNow.AddDays(-30);
        var end = to ?? DateTime.UtcNow;

        var payments = await db.Payments
            .Where(p => p.BusinessId == bizId && p.CreatedAt >= start && p.CreatedAt <= end && p.Status == PaymentStatus.Succeeded)
            .ToListAsync();

        var autoPilotRevenue = await db.AutoPilotEvents
            .Where(e => e.BusinessId == bizId && e.CreatedAt >= start && e.CreatedAt <= end)
            .SumAsync(e => (decimal?)(e.RevenueRecovered ?? 0)) ?? 0;

        var total = payments.Sum(p => p.Amount + p.TipAmount);
        var trend = payments
            .GroupBy(p => p.CreatedAt.Date)
            .OrderBy(g => g.Key)
            .Select(g => new RevenuePeriodDto(g.Key.ToString("MMM dd"), g.Sum(p => p.Amount + p.TipAmount)))
            .ToList();

        return Ok(new RevenueDto(total, autoPilotRevenue, total > 0 ? autoPilotRevenue / total * 100 : 0, trend));
    }

    [HttpGet("retention")]
    public async Task<IActionResult> GetRetention()
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var last30 = DateTime.UtcNow.AddDays(-30);
        var last60 = DateTime.UtcNow.AddDays(-60);

        var activeClients = await db.Clients.CountAsync(c => c.BusinessId == bizId && c.LastVisitAt >= last30);
        var totalClients = await db.Clients.CountAsync(c => c.BusinessId == bizId);
        var rebookRate = totalClients > 0 ? (decimal)activeClients / totalClients : 0;
        var highChurnCount = await db.Clients.CountAsync(c => c.BusinessId == bizId && c.ChurnRisk == ChurnRisk.High);

        return Ok(new RetentionDto(rebookRate, highChurnCount > 0 ? (decimal)highChurnCount / totalClients : 0, activeClients, highChurnCount, 0));
    }

    [HttpGet("team")]
    public async Task<IActionResult> GetTeam([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var start = from ?? DateTime.UtcNow.AddDays(-30);
        var end = to ?? DateTime.UtcNow;

        var staff = await db.StaffMembers.Where(s => s.BusinessId == bizId && s.IsActive).ToListAsync();
        var bookings = await db.Bookings.Where(b => b.BusinessId == bizId && b.StartsAt >= start && b.StartsAt <= end).ToListAsync();
        var payments = await db.Payments.Where(p => p.BusinessId == bizId && p.CreatedAt >= start && p.CreatedAt <= end && p.Status == PaymentStatus.Succeeded).ToListAsync();

        var result = staff.Select(s => new
        {
            s.Id, s.FirstName, s.LastName, s.Role,
            AppointmentsCompleted = bookings.Count(b => b.StaffMemberId == s.Id && b.Status == BookingStatus.Completed),
            Revenue = payments.Where(p => bookings.Any(b => b.Id == p.BookingId && b.StaffMemberId == s.Id)).Sum(p => p.Amount)
        });
        return Ok(result);
    }

    [HttpGet("clients")]
    public async Task<IActionResult> GetClients()
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var total = await db.Clients.CountAsync(c => c.BusinessId == bizId);
        var vip = await db.Clients.CountAsync(c => c.BusinessId == bizId && c.Tags.Contains(ClientTag.VIP));
        var newClients = await db.Clients.CountAsync(c => c.BusinessId == bizId && c.CreatedAt >= DateTime.UtcNow.AddDays(-30));
        var highChurn = await db.Clients.CountAsync(c => c.BusinessId == bizId && c.ChurnRisk == ChurnRisk.High);

        return Ok(new { total, vip, newLast30Days = newClients, highChurnRisk = highChurn });
    }

    [HttpGet("ai-opportunities")]
    public async Task<IActionResult> GetAiOpportunities()
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var overdueClients = await db.Clients.CountAsync(c => c.BusinessId == bizId && c.NextVisitDueAt != null && c.NextVisitDueAt < DateTime.UtcNow);
        var highChurn = await db.Clients.CountAsync(c => c.BusinessId == bizId && c.ChurnRisk == ChurnRisk.High);

        return Ok(new
        {
            opportunities = new[]
            {
                new { type = "rebook", description = $"{overdueClients} clients are overdue for a rebook", estimatedRevenue = overdueClients * 45m },
                new { type = "winback", description = $"{highChurn} clients at high churn risk", estimatedRevenue = highChurn * 90m },
                new { type = "upsell", description = "Suggest add-on services to frequent visitors", estimatedRevenue = 250m }
            }
        });
    }

    [HttpGet("missed-revenue")]
    public async Task<IActionResult> GetMissedRevenue([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var start = from ?? DateTime.UtcNow.AddDays(-30);
        var end = to ?? DateTime.UtcNow;

        var noShows = await db.Bookings.Where(b => b.BusinessId == bizId && b.StartsAt >= start && b.StartsAt <= end && b.Status == BookingStatus.NoShow).ToListAsync();
        var cancelled = await db.Bookings.Where(b => b.BusinessId == bizId && b.StartsAt >= start && b.StartsAt <= end && b.Status == BookingStatus.Cancelled).ToListAsync();

        return Ok(new MissedRevenueDto(
            cancelled.Sum(b => b.Price),
            noShows.Sum(b => b.Price) * 0.3m,
            cancelled.Count + noShows.Count));
    }

    [HttpGet("services")]
    public async Task<IActionResult> GetServices([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var start = from ?? DateTime.UtcNow.AddDays(-30);
        var end = to ?? DateTime.UtcNow;

        var services = await db.Services.Where(s => s.BusinessId == bizId).ToListAsync();
        var bookings = await db.Bookings.Where(b => b.BusinessId == bizId && b.StartsAt >= start && b.StartsAt <= end && b.Status == BookingStatus.Completed).ToListAsync();

        var result = services.Select(s => new
        {
            s.Id, s.Name, s.Price,
            BookingsCount = bookings.Count(b => b.ServiceId == s.Id),
            Revenue = bookings.Where(b => b.ServiceId == s.Id).Sum(b => b.Price)
        }).OrderByDescending(s => s.Revenue);

        return Ok(result);
    }
}
