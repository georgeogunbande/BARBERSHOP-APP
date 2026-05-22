using FlatPurse.Models;

namespace FlatPurse.Services;

public class AutoPilotService
{
    private readonly ApiService _api;

    public AutoPilotService(ApiService api) => _api = api;

    public Task<AutoPilotStatusDto?> GetStatusAsync() =>
        _api.GetAsync<AutoPilotStatusDto>("autopilot");

    public Task<IEnumerable<FlowStatusDto>?> GetFlowsAsync() =>
        _api.GetAsync<IEnumerable<FlowStatusDto>>("autopilot/flows");

    public Task<object?> UpdateFlowAsync(string flowId, UpdateFlowRequest req) =>
        _api.PatchAsync<object>($"autopilot/flows/{flowId}", req);

    public Task<object?> UpdateGlobalAsync(bool enabled) =>
        _api.PatchAsync<object>("autopilot", new { GloballyEnabled = enabled });

    public Task<object?> GetEventsAsync(int page = 1, int limit = 50) =>
        _api.GetAsync<object>($"autopilot/events?page={page}&limit={limit}");

    public Task<AutoPilotStatsDto?> GetStatsAsync() =>
        _api.GetAsync<AutoPilotStatsDto>("autopilot/stats");

    public Task<object?> GetRevenueAsync() =>
        _api.GetAsync<object>("autopilot/revenue");
}
