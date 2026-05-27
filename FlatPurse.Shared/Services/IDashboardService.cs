using FlatPurse.Models;

namespace FlatPurse.Services;

public interface IDashboardService
{
    Task<DailyBriefDto?> GetTodayBriefAsync();
}
