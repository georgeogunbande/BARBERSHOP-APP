using FlatPurse.Models;

namespace FlatPurse.Services;

public class AuthService : IAuthService
{
    private readonly IApiService _api;
    private readonly ITokenStorage _tokenStorage;
    private readonly IAppStateService _state;

    public AuthService(IApiService api, ITokenStorage tokenStorage, IAppStateService state)
    {
        _api = api;
        _tokenStorage = tokenStorage;
        _state = state;
    }

    public async Task<bool> LoginAsync(string email, string password)
    {
        var result = await _api.PostAsync<AuthResponse>("auth/login", new LoginRequest(email, password));
        if (result == null) return false;
        await _tokenStorage.SetTokenAsync(result.AccessToken);
        _state.SetUser(result.User);
        return true;
    }

    public async Task<bool> RegisterAsync(RegisterRequest req)
    {
        var result = await _api.PostAsync<AuthResponse>("auth/register", req);
        if (result == null) return false;
        await _tokenStorage.SetTokenAsync(result.AccessToken);
        _state.SetUser(result.User);
        return true;
    }

    public async Task LogoutAsync()
    {
        await _tokenStorage.ClearTokenAsync();
        _state.SetUser(null);
    }

    public async Task<bool> TryRestoreSessionAsync()
    {
        var token = await _tokenStorage.GetTokenAsync();
        if (string.IsNullOrEmpty(token)) return false;
        var user = await _api.GetAsync<UserDto>("auth/me");
        if (user == null)
        {
            await _tokenStorage.ClearTokenAsync();
            return false;
        }
        _state.SetUser(user);
        return true;
    }
}
