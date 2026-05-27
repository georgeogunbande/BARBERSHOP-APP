using FlatPurse.Models;

namespace FlatPurse.Services;

public interface IStaffService
{
    Task<IEnumerable<StaffDto>?> GetAllAsync();
    Task<StaffDto?> CreateAsync(CreateStaffRequest req);
    Task<StaffDto?> UpdateAsync(Guid id, UpdateStaffRequest req);
    Task DeleteAsync(Guid id);
    Task<StaffPerformanceDto?> GetPerformanceAsync(Guid id, string? month = null);
}
