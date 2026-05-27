using FlatPurse.Models;

namespace FlatPurse.Services;

public class ServiceCatalogService : IServiceCatalogService
{
    private readonly IApiService _api;

    public ServiceCatalogService(IApiService api) => _api = api;

    public Task<IEnumerable<ServiceDto>?> GetAllAsync() =>
        _api.GetAsync<IEnumerable<ServiceDto>>("services");

    public Task<ServiceDto?> GetAsync(Guid id) =>
        _api.GetAsync<ServiceDto>($"services/{id}");

    public Task<ServiceDto?> CreateAsync(CreateServiceRequest req) =>
        _api.PostAsync<ServiceDto>("services", req);

    public Task<ServiceDto?> UpdateAsync(Guid id, UpdateServiceRequest req) =>
        _api.PatchAsync<ServiceDto>($"services/{id}", req);

    public Task DeleteAsync(Guid id) =>
        _api.DeleteAsync($"services/{id}");
}
