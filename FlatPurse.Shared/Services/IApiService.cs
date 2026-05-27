namespace FlatPurse.Services;

public interface IApiService
{
    Task DeleteAsync(string path);
    Task<T?> GetAsync<T>(string path);
    Task<T?> PatchAsync<T>(string path, object body);
    Task<T?> PostAsync<T>(string path, object body);
}