namespace BarbershopApi.Features.Clients.Entities;

public sealed class Client
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid BarberShopId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Tags { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;
    public int TotalVisits { get; set; }
    public decimal TotalSpent { get; set; }
    public DateTime? LastVisitAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
