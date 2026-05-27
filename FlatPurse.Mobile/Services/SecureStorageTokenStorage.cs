using FlatPurse.Services;

namespace FlatPurse.Mobile.Services;

public class SecureStorageTokenStorage : ITokenStorage
{
    private const string TokenKey = "auth_token";

    private const string OnboardingKey = "onboarding_seen";

    public Task<string?> GetTokenAsync()
        => SecureStorage.GetAsync(TokenKey);

    public Task SetTokenAsync(string token)
        => SecureStorage.SetAsync(TokenKey, token);

    public Task ClearTokenAsync()
    {
        SecureStorage.Remove(TokenKey);
        return Task.CompletedTask;
    }

    public async Task<bool> HasSeenOnboardingAsync()
    {
        var value = await SecureStorage.GetAsync(OnboardingKey);
        return value == "1";
    }

    public Task MarkOnboardingSeenAsync()
        => SecureStorage.SetAsync(OnboardingKey, "1");
}
