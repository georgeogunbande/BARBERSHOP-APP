using BarbershopApi.Data;
using BarbershopApi.Models.Payments;

namespace BarbershopApi.Services;

public interface IAuditService
{
    Task LogAsync(Guid businessId, string? userId, string action, string entityType, string? entityId = null, string? details = null, string? ipAddress = null);
}

public class AuditService(AppDbContext db) : IAuditService
{
    public async Task LogAsync(Guid businessId, string? userId, string action, string entityType, string? entityId = null, string? details = null, string? ipAddress = null)
    {
        db.AuditLogs.Add(new AuditLog
        {
            BusinessId = businessId,
            UserId = userId,
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            Details = details,
            IpAddress = ipAddress
        });
        await db.SaveChangesAsync();
    }
}
