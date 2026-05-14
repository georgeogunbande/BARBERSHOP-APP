using BarbershopApi.Models.Enums;

namespace BarbershopApi.Models.AutoPilot;

public class AutoPilotEvent
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid BusinessId { get; set; }
    public AutoPilotFlowId FlowId { get; set; }
    public Guid? ClientId { get; set; }
    public string? Description { get; set; }
    public bool WasSuccessful { get; set; } = true;
    public decimal? RevenueRecovered { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
