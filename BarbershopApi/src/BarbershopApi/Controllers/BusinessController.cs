using BarbershopApi.Data;
using BarbershopApi.DTOs;
using BarbershopApi.Models.Business;
using BarbershopApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BarbershopApi.Controllers;

[ApiController]
[Route("business")]
[Authorize]
public class BusinessController(AppDbContext db, ITenantService tenant) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var biz = await GetBizAsync();
        return biz == null ? NotFound() : Ok(MapBusiness(biz));
    }

    [HttpPatch]
    public async Task<IActionResult> Update([FromBody] UpdateBusinessRequest req)
    {
        var biz = await GetBizAsync();
        if (biz == null) return NotFound();

        if (req.Name != null) biz.Name = req.Name;
        if (req.City != null) biz.City = req.City;
        if (req.Type != null) biz.Type = req.Type;
        await db.SaveChangesAsync();
        return Ok(MapBusiness(biz));
    }

    [HttpGet("booking-link")]
    public async Task<IActionResult> GetBookingLink()
    {
        var biz = await GetBizAsync();
        if (biz == null) return NotFound();
        if (string.IsNullOrEmpty(biz.BookingHandle))
            return Ok(new { handle = (string?)null, url = (string?)null });

        var url = $"https://book.flatpurse.com/{biz.BookingHandle}";
        return Ok(new BookingLinkDto(url, biz.BookingHandle, $"{url}/qr"));
    }

    [HttpPost("booking-link")]
    public async Task<IActionResult> SetBookingLink([FromBody] SetBookingHandleRequest req)
    {
        var handle = req.Handle.ToLowerInvariant().Trim();
        if (await db.Businesses.AnyAsync(b => b.BookingHandle == handle))
            return Conflict(Error("HANDLE_TAKEN", "That booking handle is already taken.", 409));

        var biz = await GetBizAsync();
        if (biz == null) return NotFound();
        biz.BookingHandle = handle;
        await db.SaveChangesAsync();

        var url = $"https://book.flatpurse.com/{handle}";
        return Ok(new BookingLinkDto(url, handle, $"{url}/qr"));
    }

    [HttpGet("hours")]
    public async Task<IActionResult> GetHours()
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var hours = await db.BusinessHours.Where(h => h.BusinessId == bizId).ToListAsync();
        return Ok(hours.Select(h => new DayHoursDto(h.DayOfWeek, h.IsClosed, h.OpenTime, h.CloseTime)));
    }

    [HttpPut("hours")]
    public async Task<IActionResult> UpdateHours([FromBody] UpdateHoursRequest req)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var existing = await db.BusinessHours.Where(h => h.BusinessId == bizId).ToListAsync();
        db.BusinessHours.RemoveRange(existing);

        foreach (var day in req.Hours)
        {
            db.BusinessHours.Add(new BusinessHours
            {
                BusinessId = bizId,
                DayOfWeek = day.DayOfWeek,
                IsClosed = day.IsClosed,
                OpenTime = day.OpenTime ?? TimeOnly.MinValue,
                CloseTime = day.CloseTime ?? TimeOnly.MaxValue
            });
        }
        await db.SaveChangesAsync();
        return Ok(req.Hours);
    }

    [HttpGet("family-hours")]
    public async Task<IActionResult> GetFamilyHours()
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var fh = await db.FamilyHoursConfigs.FirstOrDefaultAsync(f => f.BusinessId == bizId);
        return Ok(fh == null ? new { isEnabled = false } : (object)new
        {
            isEnabled = fh.IsEnabled,
            startTime = fh.StartTime,
            endTime = fh.EndTime,
            days = fh.Days,
            message = fh.Message
        });
    }

    [HttpPut("family-hours")]
    public async Task<IActionResult> UpdateFamilyHours([FromBody] UpdateFamilyHoursRequest req)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var fh = await db.FamilyHoursConfigs.FirstOrDefaultAsync(f => f.BusinessId == bizId);
        if (fh == null)
        {
            fh = new FamilyHoursConfig { BusinessId = bizId };
            db.FamilyHoursConfigs.Add(fh);
        }
        fh.IsEnabled = req.IsEnabled;
        if (req.StartTime.HasValue) fh.StartTime = req.StartTime.Value;
        if (req.EndTime.HasValue) fh.EndTime = req.EndTime.Value;
        if (req.Days != null) fh.Days = req.Days;
        if (req.Message != null) fh.Message = req.Message;
        await db.SaveChangesAsync();
        return Ok(fh);
    }

    [HttpGet("themes")]
    public IActionResult GetThemes() => Ok(new[]
    {
        new { id = "default", name = "Default", preview = "/themes/default.png" },
        new { id = "dark", name = "Dark Mode", preview = "/themes/dark.png" },
        new { id = "minimal", name = "Minimal", preview = "/themes/minimal.png" },
        new { id = "bold", name = "Bold & Vibrant", preview = "/themes/bold.png" }
    });

    [HttpPut("theme")]
    public async Task<IActionResult> SetTheme([FromBody] SetThemeRequest req)
    {
        var biz = await GetBizAsync();
        if (biz == null) return NotFound();
        biz.ActiveTheme = req.Theme;
        await db.SaveChangesAsync();
        return Ok(new { theme = req.Theme });
    }

    [HttpPost("media/upload")]
    public async Task<IActionResult> UploadMedia(IFormFile file, [FromQuery] string type = "logo")
    {
        if (file.Length == 0) return BadRequest(Error("EMPTY_FILE", "No file provided.", 400));
        var bizId = tenant.GetBusinessId()!.Value;

        // In production: upload to S3/Azure Blob, return URL
        var fakeUrl = $"https://cdn.flatpurse.com/{bizId}/{Guid.NewGuid()}/{file.FileName}";
        if (!Enum.TryParse<Models.Enums.MediaType>(type, true, out var mediaType))
            mediaType = Models.Enums.MediaType.Logo;

        var media = new BusinessMedia
        {
            BusinessId = bizId,
            Url = fakeUrl,
            FileName = file.FileName,
            FileSizeBytes = file.Length,
            Type = mediaType
        };
        db.BusinessMedia.Add(media);
        await db.SaveChangesAsync();
        return Ok(new { id = media.Id, url = fakeUrl });
    }

    [HttpDelete("media/{id:guid}")]
    public async Task<IActionResult> DeleteMedia(Guid id)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var media = await db.BusinessMedia.FirstOrDefaultAsync(m => m.Id == id && m.BusinessId == bizId);
        if (media == null) return NotFound();
        db.BusinessMedia.Remove(media);
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("onboarding")]
    public async Task<IActionResult> GetOnboarding()
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var biz = await GetBizAsync();
        var hasServices = await db.Services.AnyAsync(s => s.BusinessId == bizId);
        var hasStaff = await db.StaffMembers.AnyAsync(s => s.BusinessId == bizId);
        var hasHours = await db.BusinessHours.AnyAsync(h => h.BusinessId == bizId);
        var hasBookingHandle = !string.IsNullOrEmpty(biz?.BookingHandle);
        var hasPayments = !string.IsNullOrEmpty(biz?.StripeAccountId);
        var hasTheme = !string.IsNullOrEmpty(biz?.ActiveTheme);

        var completed = new[] { hasServices, hasStaff, hasHours, hasBookingHandle, hasPayments, hasTheme }.Count(x => x);
        return Ok(new OnboardingStatusDto(hasServices, hasStaff, hasHours, hasBookingHandle, hasPayments, hasTheme, completed * 100 / 6));
    }

    [HttpPost("migrate/import")]
    public IActionResult MigrateImport([FromBody] object payload) =>
        Ok(new { message = "Import job queued. You will be notified when complete.", job_id = Guid.NewGuid() });

    [HttpPost("migrate/csv")]
    public IActionResult MigrateCsv(IFormFile file) =>
        Ok(new { message = "CSV import job queued.", job_id = Guid.NewGuid() });

    private async Task<Business?> GetBizAsync()
    {
        var id = tenant.GetBusinessId();
        return id.HasValue ? await db.Businesses.FindAsync(id) : null;
    }

    private static BusinessDto MapBusiness(Business b) => new(b.Id, b.Name, b.City, b.Type, b.LogoUrl, b.CoverPhotoUrl, b.BookingHandle, b.ActiveTheme, b.Currency, b.CreatedAt);

    private static object Error(string code, string message, int status) => new
    {
        error = new { code, message, status, request_id = Guid.NewGuid().ToString() }
    };
}
