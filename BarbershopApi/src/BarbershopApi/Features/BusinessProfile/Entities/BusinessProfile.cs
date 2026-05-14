namespace BarbershopApi.Features.BusinessProfile.Entities;

public sealed class BusinessProfile
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid BarberShopId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Website { get; set; } = string.Empty;
    public string BookingLinkSlug { get; set; } = string.Empty;
    public string LogoUrl { get; set; } = string.Empty;
    public string WorkingHoursJson { get; set; } = "{}";
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
