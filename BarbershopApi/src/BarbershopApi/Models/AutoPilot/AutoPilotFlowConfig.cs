using BarbershopApi.Models.Enums;

namespace BarbershopApi.Models.AutoPilot;

public class AutoPilotFlowConfig
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid BusinessId { get; set; }
    public AutoPilotFlowId FlowId { get; set; }
    public bool IsEnabled { get; set; } = true;
    public string? CustomSettings { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
