using BarbershopApi.Models.Enums;

namespace BarbershopApi.Models.Staff;

public class StaffMember
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid BusinessId { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? AvatarUrl { get; set; }
    public string? Colour { get; set; } = "#6366f1";
    public StaffRole Role { get; set; } = StaffRole.Stylist;
    public bool IsActive { get; set; } = true;
    public List<Guid> ServiceIds { get; set; } = [];
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<StaffSchedule> Schedules { get; set; } = [];

    public string FullName => $"{FirstName} {LastName}".Trim();
}
