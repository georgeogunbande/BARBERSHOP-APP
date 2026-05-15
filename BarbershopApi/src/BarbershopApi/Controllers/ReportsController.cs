using BarbershopApi.Data;
using BarbershopApi.Models.Enums;
using BarbershopApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text;

namespace BarbershopApi.Controllers;

[ApiController]
[Route("reports")]
[Authorize]
public class ReportsController(AppDbContext db, ITenantService tenant) : ControllerBase
{
    [HttpGet("revenue")]
    public async Task<IActionResult> Revenue([FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] string? period)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var start = from ?? DateTime.UtcNow.AddDays(-30);
        var end = to ?? DateTime.UtcNow;

        var payments = await db.Payments
            .Where(p => p.BusinessId == bizId && p.CreatedAt >= start && p.CreatedAt <= end && p.Status == PaymentStatus.Succeeded)
            .ToListAsync();

        return Ok(new
        {
            from = start, to = end, period,
            totalRevenue = payments.Sum(p => p.Amount),
            totalTips = payments.Sum(p => p.TipAmount),
            totalPlatformFees = payments.Sum(p => p.PlatformFee),
            netRevenue = payments.Sum(p => p.NetAmount),
            transactionCount = payments.Count,
            averageTicket = payments.Any() ? payments.Average(p => p.Amount) : 0,
            byDay = payments.GroupBy(p => p.CreatedAt.Date).OrderBy(g => g.Key)
                .Select(g => new { date = g.Key, revenue = g.Sum(p => p.Amount), count = g.Count() })
        });
    }

    [HttpGet("clients")]
    public async Task<IActionResult> Clients([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var start = from ?? DateTime.UtcNow.AddDays(-30);
        var end = to ?? DateTime.UtcNow;

        var newClients = await db.Clients.CountAsync(c => c.BusinessId == bizId && c.CreatedAt >= start && c.CreatedAt <= end);
        var totalClients = await db.Clients.CountAsync(c => c.BusinessId == bizId);
        var returningClients = await db.Clients.CountAsync(c => c.BusinessId == bizId && c.VisitCount > 1 && c.LastVisitAt >= start);

        return Ok(new { from = start, to = end, newClients, totalClients, returningClients, retentionRate = totalClients > 0 ? (decimal)returningClients / totalClients : 0 });
    }

    [HttpGet("staff")]
    public async Task<IActionResult> Staff([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var start = from ?? DateTime.UtcNow.AddDays(-30);
        var end = to ?? DateTime.UtcNow;

        var staff = await db.StaffMembers.Where(s => s.BusinessId == bizId && s.IsActive).ToListAsync();
        var bookings = await db.Bookings.Where(b => b.BusinessId == bizId && b.StartsAt >= start && b.StartsAt <= end).ToListAsync();

        return Ok(staff.Select(s => new
        {
            s.Id, s.FirstName, s.LastName,
            Completed = bookings.Count(b => b.StaffMemberId == s.Id && b.Status == BookingStatus.Completed),
            Cancelled = bookings.Count(b => b.StaffMemberId == s.Id && b.Status == BookingStatus.Cancelled),
            NoShows = bookings.Count(b => b.StaffMemberId == s.Id && b.Status == BookingStatus.NoShow),
            Revenue = bookings.Where(b => b.StaffMemberId == s.Id && b.Status == BookingStatus.Completed).Sum(b => b.Price)
        }));
    }

    [HttpGet("services")]
    public async Task<IActionResult> Services([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var start = from ?? DateTime.UtcNow.AddDays(-30);
        var end = to ?? DateTime.UtcNow;

        var services = await db.Services.Where(s => s.BusinessId == bizId).ToListAsync();
        var bookings = await db.Bookings.Where(b => b.BusinessId == bizId && b.StartsAt >= start && b.StartsAt <= end && b.Status == BookingStatus.Completed).ToListAsync();

        return Ok(services.Select(s => new
        {
            s.Id, s.Name, s.Price,
            BookingCount = bookings.Count(b => b.ServiceId == s.Id),
            Revenue = bookings.Where(b => b.ServiceId == s.Id).Sum(b => b.Price)
        }).OrderByDescending(s => s.Revenue));
    }

    [HttpGet("autopilot")]
    public async Task<IActionResult> AutoPilot([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var start = from ?? DateTime.UtcNow.AddDays(-30);
        var end = to ?? DateTime.UtcNow;

        var events = await db.AutoPilotEvents.Where(e => e.BusinessId == bizId && e.CreatedAt >= start && e.CreatedAt <= end).ToListAsync();
        return Ok(new
        {
            from = start, to = end,
            totalEvents = events.Count,
            successfulEvents = events.Count(e => e.WasSuccessful),
            totalRevenueRecovered = events.Sum(e => e.RevenueRecovered ?? 0),
            byFlow = events.GroupBy(e => e.FlowId).Select(g => new { flow = g.Key.ToString(), count = g.Count(), revenue = g.Sum(e => e.RevenueRecovered ?? 0) })
        });
    }

    [HttpGet("tax")]
    public async Task<IActionResult> Tax([FromQuery] int? year)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var taxYear = year ?? DateTime.UtcNow.Year;
        var start = new DateTime(taxYear, 1, 1);
        var end = new DateTime(taxYear, 12, 31, 23, 59, 59);

        var payments = await db.Payments
            .Where(p => p.BusinessId == bizId && p.CreatedAt >= start && p.CreatedAt <= end && p.Status == PaymentStatus.Succeeded)
            .ToListAsync();

        return Ok(new
        {
            year = taxYear,
            grossRevenue = payments.Sum(p => p.Amount),
            tips = payments.Sum(p => p.TipAmount),
            platformFees = payments.Sum(p => p.PlatformFee),
            netRevenue = payments.Sum(p => p.NetAmount),
            transactionCount = payments.Count
        });
    }

    [HttpGet("{type}/export")]
    public async Task<IActionResult> Export(string type, [FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] string format = "csv")
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var start = from ?? DateTime.UtcNow.AddDays(-30);
        var end = to ?? DateTime.UtcNow;

        var csv = new StringBuilder();
        switch (type.ToLower())
        {
            case "revenue":
                csv.AppendLine("Date,Amount,Tips,PlatformFee,NetAmount,Method");
                var payments = await db.Payments.Where(p => p.BusinessId == bizId && p.CreatedAt >= start && p.CreatedAt <= end).ToListAsync();
                foreach (var p in payments) csv.AppendLine($"{p.CreatedAt:O},{p.Amount},{p.TipAmount},{p.PlatformFee},{p.NetAmount},{p.Method}");
                break;
            default:
                return BadRequest(new { error = new { code = "INVALID_REPORT_TYPE", message = $"Unknown report type: {type}", status = 400 } });
        }

        return File(Encoding.UTF8.GetBytes(csv.ToString()), "text/csv", $"{type}-report-{taxYear(start, end)}.csv");
    }

    private static string taxYear(DateTime start, DateTime end) => $"{start:yyyy-MM-dd}-{end:yyyy-MM-dd}";
}
