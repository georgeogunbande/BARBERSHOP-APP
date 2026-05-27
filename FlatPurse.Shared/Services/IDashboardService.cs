namespace FlatPurse.Services;

public interface IDashboardService
{
    Task<object?> GetTodayBriefAsync();
}
