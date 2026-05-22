using System.Net.Http.Json;
using System.Net.Http.Headers;

namespace FlatPurse.Services;

public class ApiService
{
    private readonly HttpClient _http;
    private readonly ITokenStorage _tokenStorage;

    public ApiService(HttpClient http, ITokenStorage tokenStorage)
    {
        _http = http;
        _tokenStorage = tokenStorage;
    }

    private async Task AttachTokenAsync()
    {
        var token = await _tokenStorage.GetTokenAsync();
        _http.DefaultRequestHeaders.Authorization = token != null
            ? new AuthenticationHeaderValue("Bearer", token)
            : null;
    }

    public async Task<T?> GetAsync<T>(string path)
    {
        await AttachTokenAsync();
        var response = await _http.GetAsync(path);
        if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
        {
            await _tokenStorage.ClearTokenAsync();
            return default;
        }
        if (!response.IsSuccessStatusCode) return default;
        return await response.Content.ReadFromJsonAsync<T>();
    }

    public async Task<T?> PostAsync<T>(string path, object body)
    {
        await AttachTokenAsync();
        var response = await _http.PostAsJsonAsync(path, body);
        if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
        {
            await _tokenStorage.ClearTokenAsync();
            return default;
        }
        if (!response.IsSuccessStatusCode) return default;
        return await response.Content.ReadFromJsonAsync<T>();
    }

    public async Task<T?> PatchAsync<T>(string path, object body)
    {
        await AttachTokenAsync();
        var response = await _http.PatchAsJsonAsync(path, body);
        if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
        {
            await _tokenStorage.ClearTokenAsync();
            return default;
        }
        if (!response.IsSuccessStatusCode) return default;
        return await response.Content.ReadFromJsonAsync<T>();
    }

    public async Task DeleteAsync(string path)
    {
        await AttachTokenAsync();
        var response = await _http.DeleteAsync(path);
        if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
            await _tokenStorage.ClearTokenAsync();
    }
}
