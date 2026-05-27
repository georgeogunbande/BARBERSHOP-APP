namespace FlatPurse.Services;

public class DashboardService : IDashboardService
{
    private readonly IApiService _api;

    public DashboardService(IApiService api) => _api = api;

    public Task<object?> GetTodayBriefAsync() =>
        _api.GetAsync<object>("brief/today");
}
