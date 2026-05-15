namespace BarbershopApi.Models.Services;

public class Service
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid BusinessId { get; set; }
    public Guid? CategoryId { get; set; }
    public ServiceCategory? Category { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int DurationMins { get; set; }
    public decimal DepositPct { get; set; } = 0;
    public bool Active { get; set; } = true;
    public int SortOrder { get; set; } = 0;
    public int BookingCount { get; set; } = 0;
    public bool IsDeleted { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
