namespace FlatPurse.Services;

public class DashboardService
{
    private readonly ApiService _api;

    public DashboardService(ApiService api) => _api = api;

    public Task<object?> GetTodayBriefAsync() =>
        _api.GetAsync<object>("brief/today");
}
