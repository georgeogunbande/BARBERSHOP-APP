using FlatPurse.Models;

namespace FlatPurse.Services;

public class StaffService : IStaffService
{
    private readonly IApiService _api;

    public StaffService(IApiService api) => _api = api;

    public Task<IEnumerable<StaffDto>?> GetAllAsync() =>
        _api.GetAsync<IEnumerable<StaffDto>>("staff");

    public Task<StaffDto?> CreateAsync(CreateStaffRequest req) =>
        _api.PostAsync<StaffDto>("staff", req);

    public Task<StaffDto?> UpdateAsync(Guid id, UpdateStaffRequest req) =>
        _api.PatchAsync<StaffDto>($"staff/{id}", req);

    public Task DeleteAsync(Guid id) =>
        _api.DeleteAsync($"staff/{id}");

    public Task<StaffPerformanceDto?> GetPerformanceAsync(Guid id, string? month = null)
    {
        var query = $"staff/{id}/performance";
        if (month != null) query += $"?month={month}";
        return _api.GetAsync<StaffPerformanceDto>(query);
    }
}
