using BarbershopApi.Models.Enums;

namespace BarbershopApi.Models.Auth;

public class InviteToken
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Token { get; set; } = Guid.NewGuid().ToString("N");
    public string Email { get; set; } = string.Empty;
    public Guid BusinessId { get; set; }
    public StaffRole Role { get; set; } = StaffRole.Stylist;
    public string InvitedByUserId { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; } = DateTime.UtcNow.AddDays(7);
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? AcceptedAt { get; set; }
    public bool IsExpired => DateTime.UtcNow >= ExpiresAt;
    public bool IsAccepted => AcceptedAt != null;
}
