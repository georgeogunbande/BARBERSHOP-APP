using FlatPurse.Models;

namespace FlatPurse.Services;

public interface IServiceCatalogService
{
    Task<IEnumerable<ServiceDto>?> GetAllAsync();
    Task<ServiceDto?> GetAsync(Guid id);
    Task<ServiceDto?> CreateAsync(CreateServiceRequest req);
    Task<ServiceDto?> UpdateAsync(Guid id, UpdateServiceRequest req);
    Task DeleteAsync(Guid id);
}
