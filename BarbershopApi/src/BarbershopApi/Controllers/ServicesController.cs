using BarbershopApi.Data;
using BarbershopApi.DTOs;
using BarbershopApi.Models.Services;
using BarbershopApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BarbershopApi.Controllers;

[ApiController]
[Route("services")]
[Authorize]
public class ServicesController(AppDbContext db, ITenantService tenant) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List()
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var services = await db.Services
            .Include(s => s.Category)
            .Where(s => s.BusinessId == bizId)
            .OrderBy(s => s.SortOrder)
            .ToListAsync();
        return Ok(services.Select(MapService));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateServiceRequest req)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var service = new Service
        {
            BusinessId = bizId,
            Name = req.Name,
            Price = req.Price,
            DurationMins = req.DurationMins,
            CategoryId = req.CategoryId,
            DepositPct = req.DepositPct
        };
        db.Services.Add(service);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = service.Id }, MapService(service));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var service = await db.Services.Include(s => s.Category)
            .FirstOrDefaultAsync(s => s.Id == id && s.BusinessId == bizId);
        return service == null ? NotFound() : Ok(MapService(service));
    }

    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateServiceRequest req)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var service = await db.Services.FirstOrDefaultAsync(s => s.Id == id && s.BusinessId == bizId);
        if (service == null) return NotFound();

        if (req.Name != null) service.Name = req.Name;
        if (req.Price.HasValue) service.Price = req.Price.Value;
        if (req.DurationMins.HasValue) service.DurationMins = req.DurationMins.Value;
        if (req.CategoryId.HasValue) service.CategoryId = req.CategoryId;
        if (req.DepositPct.HasValue) service.DepositPct = req.DepositPct.Value;
        if (req.Active.HasValue) service.Active = req.Active.Value;
        service.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        return Ok(MapService(service));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Archive(Guid id)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var service = await db.Services.FirstOrDefaultAsync(s => s.Id == id && s.BusinessId == bizId);
        if (service == null) return NotFound();
        service.IsDeleted = true;
        service.Active = false;
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id:guid}/duplicate")]
    public async Task<IActionResult> Duplicate(Guid id)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var original = await db.Services.FirstOrDefaultAsync(s => s.Id == id && s.BusinessId == bizId);
        if (original == null) return NotFound();

        var copy = new Service
        {
            BusinessId = bizId,
            Name = $"{original.Name} (Copy)",
            Price = original.Price,
            DurationMins = original.DurationMins,
            CategoryId = original.CategoryId,
            DepositPct = original.DepositPct,
            Active = false
        };
        db.Services.Add(copy);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = copy.Id }, MapService(copy));
    }

    [HttpGet("categories")]
    public async Task<IActionResult> GetCategories()
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var cats = await db.ServiceCategories
            .Include(c => c.Services)
            .Where(c => c.BusinessId == bizId)
            .OrderBy(c => c.SortOrder)
            .ToListAsync();
        return Ok(cats.Select(c => new ServiceCategoryDto(c.Id, c.Name, c.SortOrder, c.Services.Select(MapService).ToList())));
    }

    [HttpPost("categories")]
    public async Task<IActionResult> CreateCategory([FromBody] CreateCategoryRequest req)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var cat = new ServiceCategory { BusinessId = bizId, Name = req.Name };
        db.ServiceCategories.Add(cat);
        await db.SaveChangesAsync();
        return Ok(new ServiceCategoryDto(cat.Id, cat.Name, cat.SortOrder, []));
    }

    [HttpPut("sort")]
    public async Task<IActionResult> Sort([FromBody] SortServicesRequest req)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var services = await db.Services.Where(s => s.BusinessId == bizId && req.ServiceIds.Contains(s.Id)).ToListAsync();
        for (int i = 0; i < req.ServiceIds.Count; i++)
        {
            var svc = services.FirstOrDefault(s => s.Id == req.ServiceIds[i]);
            if (svc != null) svc.SortOrder = i;
        }
        await db.SaveChangesAsync();
        return Ok(new { message = "Services reordered." });
    }

    private static ServiceDto MapService(Service s) => new(
        s.Id, s.Name, s.Price, s.DurationMins, s.Category?.Name, s.Active, s.DepositPct, s.BookingCount, s.CreatedAt);
}
