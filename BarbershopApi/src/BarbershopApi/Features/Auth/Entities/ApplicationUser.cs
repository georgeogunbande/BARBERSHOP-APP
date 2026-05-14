using Microsoft.AspNetCore.Identity;

namespace BarbershopApi.Features.Auth.Entities;

public sealed class ApplicationUser : IdentityUser
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public Guid BarberShopId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
