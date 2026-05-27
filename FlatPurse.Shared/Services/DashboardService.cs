using FlatPurse.Models;

namespace FlatPurse.Services;

public class DashboardService : IDashboardService
{
    private readonly IApiService _api;

    public DashboardService(IApiService api) => _api = api;

    public Task<DailyBriefDto?> GetTodayBriefAsync() =>
        _api.GetAsync<DailyBriefDto>("brief/today");
}
