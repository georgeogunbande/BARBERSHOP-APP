using FlatPurse.Services;

namespace FlatPurse.Maui.Services;

public class MauiSecureTokenStorage : ITokenStorage
{
    private const string Key = "access_token";

    public async Task<string?> GetTokenAsync()
    {
        return await SecureStorage.Default.GetAsync(Key);
    }

    public Task SetTokenAsync(string token)
    {
        return SecureStorage.Default.SetAsync(Key, token);
    }

    public Task ClearTokenAsync()
    {
        SecureStorage.Default.Remove(Key);
        return Task.CompletedTask;
    }
}
