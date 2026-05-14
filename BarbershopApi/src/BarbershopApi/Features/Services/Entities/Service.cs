namespace BarbershopApi.Features.Services.Entities;

public sealed class Service
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid BarberShopId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int DurationMinutes { get; set; }
    public string Category { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
