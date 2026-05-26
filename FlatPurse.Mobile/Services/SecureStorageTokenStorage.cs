using FlatPurse.Services;

namespace FlatPurse.Mobile.Services;

public class SecureStorageTokenStorage : ITokenStorage
{
    private const string TokenKey = "auth_token";

    public Task<string?> GetTokenAsync()
        => SecureStorage.GetAsync(TokenKey);

    public Task SetTokenAsync(string token)
        => SecureStorage.SetAsync(TokenKey, token);

    public Task ClearTokenAsync()
    {
        SecureStorage.Remove(TokenKey);
        return Task.CompletedTask;
    }
}
