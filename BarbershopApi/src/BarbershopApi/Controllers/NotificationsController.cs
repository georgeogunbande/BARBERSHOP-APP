using BarbershopApi.Data;
using BarbershopApi.DTOs;
using BarbershopApi.Models.Messaging;
using BarbershopApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BarbershopApi.Controllers;

[ApiController]
[Route("notifications")]
[Authorize]
public class NotificationsController(AppDbContext db, ITenantService tenant) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int page = 1, [FromQuery] int limit = 20)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var userId = tenant.GetUserId()!;
        var query = db.Notifications.Where(n => n.BusinessId == bizId && n.UserId == userId).OrderByDescending(n => n.CreatedAt);
        var total = await query.CountAsync();
        var notifications = await query.Skip((page - 1) * limit).Take(limit).ToListAsync();
        return Ok(new { items = notifications.Select(MapNotification), total, page, limit, unreadCount = await db.Notifications.CountAsync(n => n.BusinessId == bizId && n.UserId == userId && !n.IsRead) });
    }

    [HttpPatch("read-all")]
    public async Task<IActionResult> ReadAll()
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var userId = tenant.GetUserId()!;
        var unread = await db.Notifications.Where(n => n.BusinessId == bizId && n.UserId == userId && !n.IsRead).ToListAsync();
        unread.ForEach(n => { n.IsRead = true; n.ReadAt = DateTime.UtcNow; });
        await db.SaveChangesAsync();
        return Ok(new { message = $"{unread.Count} notifications marked as read." });
    }

    [HttpPatch("{id:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid id)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var userId = tenant.GetUserId()!;
        var notification = await db.Notifications.FirstOrDefaultAsync(n => n.Id == id && n.BusinessId == bizId && n.UserId == userId);
        if (notification == null) return NotFound();
        notification.IsRead = true;
        notification.ReadAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(MapNotification(notification));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Dismiss(Guid id)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var userId = tenant.GetUserId()!;
        var notification = await db.Notifications.FirstOrDefaultAsync(n => n.Id == id && n.BusinessId == bizId && n.UserId == userId);
        if (notification == null) return NotFound();
        db.Notifications.Remove(notification);
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("devices")]
    public async Task<IActionResult> RegisterDevice([FromBody] RegisterDeviceRequest req)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var userId = tenant.GetUserId()!;
        var existing = await db.DeviceTokens.FirstOrDefaultAsync(d => d.Token == req.Token && d.UserId == userId);
        if (existing != null)
        {
            existing.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
            return Ok(new { message = "Device token updated." });
        }

        db.DeviceTokens.Add(new DeviceToken { UserId = userId, BusinessId = bizId, Token = req.Token, Platform = req.Platform });
        await db.SaveChangesAsync();
        return Ok(new { message = "Device registered for push notifications." });
    }

    [HttpDelete("devices/{token}")]
    public async Task<IActionResult> UnregisterDevice(string token)
    {
        var userId = tenant.GetUserId()!;
        var device = await db.DeviceTokens.FirstOrDefaultAsync(d => d.Token == token && d.UserId == userId);
        if (device == null) return NotFound();
        db.DeviceTokens.Remove(device);
        await db.SaveChangesAsync();
        return NoContent();
    }

    private static NotificationDto MapNotification(Notification n) => new(n.Id, n.Type, n.Title, n.Body, n.IsRead, n.CreatedAt);
}
