using System.Security.Claims;

namespace BarbershopApi.Services;

public interface ITenantService
{
    Guid? GetBusinessId();
    string? GetUserId();
    string? GetUserRole();
    bool IsOwnerOrManager();
}

public class TenantService(IHttpContextAccessor accessor) : ITenantService
{
    private ClaimsPrincipal? User => accessor.HttpContext?.User;

    public Guid? GetBusinessId()
    {
        var claim = User?.FindFirst("business_id")?.Value;
        return Guid.TryParse(claim, out var id) ? id : null;
    }

    public string? GetUserId() => User?.FindFirst(ClaimTypes.NameIdentifier)?.Value
        ?? User?.FindFirst("sub")?.Value;

    public string? GetUserRole() => User?.FindFirst("role")?.Value;

    public bool IsOwnerOrManager()
    {
        var role = GetUserRole();
        return role is "Owner" or "Manager";
    }
}
