using Microsoft.AspNetCore.Identity;
using BarbershopApi.Models.Enums;

namespace BarbershopApi.Models.Auth;

public class ApplicationUser : IdentityUser
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public Guid? BusinessId { get; set; }
    public StaffRole Role { get; set; } = StaffRole.Owner;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<RefreshToken> RefreshTokens { get; set; } = [];
}
