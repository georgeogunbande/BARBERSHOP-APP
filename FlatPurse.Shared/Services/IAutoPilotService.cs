using FlatPurse.Models;

namespace FlatPurse.Services;

public interface IAutoPilotService
{
    Task<AutoPilotStatusDto?> GetStatusAsync();
    Task<IEnumerable<FlowStatusDto>?> GetFlowsAsync();
    Task<object?> UpdateFlowAsync(string flowId, UpdateFlowRequest req);
    Task<object?> UpdateGlobalAsync(bool enabled);
    Task<object?> GetEventsAsync(int page = 1, int limit = 50);
    Task<AutoPilotStatsDto?> GetStatsAsync();
    Task<object?> GetRevenueAsync();
}
