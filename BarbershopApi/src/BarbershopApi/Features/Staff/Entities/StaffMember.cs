namespace BarbershopApi.Features.Staff.Entities;

public sealed class StaffMember
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid BarberShopId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Bio { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public string WorkingHoursJson { get; set; } = "{}";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
