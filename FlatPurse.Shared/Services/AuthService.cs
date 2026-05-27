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
        var result = await _api.PostAsync<TokenExchangeResponse>("auth/login", new LoginRequest(email, password));
        if (result == null || !result.Success || string.IsNullOrWhiteSpace(result.AccessToken))
            return false;

        await _tokenStorage.SetTokenAsync(result.AccessToken);

        // Build a UserDto from the flat token-exchange response, then enrich via /auth/me
        var user = MapTokenResponseToUser(result);
        _state.SetUser(user);

        // Fetch full profile in background to get BusinessProfile details
        _ = Task.Run(async () =>
        {
            try
            {
                var me = await _api.GetAsync<MeResponse>("auth/me");
                if (me != null)
                {
                    var enriched = MapMeResponseToUser(me);
                    _state.SetUser(enriched);
                }
            }
            catch { /* non-critical — we already have basic user info */ }
        });

        return true;
    }

    public async Task<bool> RegisterAsync(RegisterRequest req)
    {
        var result = await _api.PostAsync<TokenExchangeResponse>("auth/register", req);
        if (result == null || !result.Success || string.IsNullOrWhiteSpace(result.AccessToken))
            return false;

        await _tokenStorage.SetTokenAsync(result.AccessToken);
        var user = MapTokenResponseToUser(result);
        _state.SetUser(user);
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

        var me = await _api.GetAsync<MeResponse>("auth/me");
        if (me == null || string.IsNullOrWhiteSpace(me.AccountId))
        {
            await _tokenStorage.ClearTokenAsync();
            return false;
        }

        _state.SetUser(MapMeResponseToUser(me));
        return true;
    }

    /// <summary>Maps the flat token-exchange response to a UserDto with basic info.</summary>
    private static UserDto MapTokenResponseToUser(TokenExchangeResponse r)
    {
        var firstName = !string.IsNullOrWhiteSpace(r.FirstName) ? r.FirstName : ExtractFirstName(r.Email);
        var lastName = !string.IsNullOrWhiteSpace(r.LastName) ? r.LastName : "";

        BusinessSummaryDto? biz = null;
        if (!string.IsNullOrWhiteSpace(r.OrganizationId) && Guid.TryParse(r.OrganizationId, out var bizId))
        {
            biz = new BusinessSummaryDto(bizId, r.BusinessName ?? "Business", null, r.BusinessType, null, null, SubscriptionPlan.Starter);
        }

        return new UserDto(
            Id: r.AccountId,
            FirstName: firstName,
            LastName: lastName,
            Email: r.Email ?? "",
            Phone: null,
            AvatarUrl: null,
            Role: StaffRole.Owner,
            BusinessId: biz?.Id,
            Business: biz);
    }

    /// <summary>Maps the /auth/me response to a UserDto with full profile details.</summary>
    private static UserDto MapMeResponseToUser(MeResponse me)
    {
        var firstName = !string.IsNullOrWhiteSpace(me.FirstName) ? me.FirstName : ExtractFirstName(me.Email);
        var lastName = !string.IsNullOrWhiteSpace(me.LastName) ? me.LastName : "";

        BusinessSummaryDto? biz = null;
        if (me.BusinessProfile != null)
        {
            biz = new BusinessSummaryDto(
                Id: me.BusinessProfile.Id,
                Name: me.BusinessProfile.BusinessName ?? me.BusinessName ?? "Business",
                City: me.BusinessProfile.City,
                Type: me.BusinessProfile.BusinessType ?? me.BusinessType,
                LogoUrl: me.BusinessProfile.LogoUrl,
                BookingHandle: me.BusinessProfile.BookingPageHandle,
                Plan: SubscriptionPlan.Starter);
        }

        return new UserDto(
            Id: me.AccountId,
            FirstName: firstName,
            LastName: lastName,
            Email: me.Email ?? "",
            Phone: me.BusinessProfile?.PhoneNumber,
            AvatarUrl: null,
            Role: StaffRole.Owner,
            BusinessId: biz?.Id,
            Business: biz);
    }

    /// <summary>Extracts a display name from an email address as a last resort.</summary>
    private static string ExtractFirstName(string? email)
    {
        if (string.IsNullOrWhiteSpace(email)) return "User";
        var local = email.Split('@')[0];
        // Capitalize first letter
        return local.Length > 0 ? char.ToUpper(local[0]) + local[1..] : "User";
    }
}
