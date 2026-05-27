using Microsoft.JSInterop;

namespace FlatPurse.Services;

public class LocalStorageTokenStorage : ITokenStorage
{
    private readonly IJSRuntime _js;
    private const string TokenKey = "auth_token";

    public LocalStorageTokenStorage(IJSRuntime js)
    {
        _js = js;
    }

    private const string OnboardingKey = "onboarding_seen";

    public async Task<string?> GetTokenAsync()
        => await _js.InvokeAsync<string?>("localStorage.getItem", TokenKey);

    public async Task SetTokenAsync(string token)
        => await _js.InvokeVoidAsync("localStorage.setItem", TokenKey, token);

    public async Task ClearTokenAsync()
        => await _js.InvokeVoidAsync("localStorage.removeItem", TokenKey);

    public async Task<bool> HasSeenOnboardingAsync()
    {
        var value = await _js.InvokeAsync<string?>("localStorage.getItem", OnboardingKey);
        return value == "1";
    }

    public async Task MarkOnboardingSeenAsync()
        => await _js.InvokeVoidAsync("localStorage.setItem", OnboardingKey, "1");
}
