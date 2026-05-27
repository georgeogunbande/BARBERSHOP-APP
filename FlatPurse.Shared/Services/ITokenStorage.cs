namespace FlatPurse.Services;

public interface ITokenStorage
{
    Task<string?> GetTokenAsync();
    Task SetTokenAsync(string token);
    Task ClearTokenAsync();

    /// <summary>Returns true if the user has previously seen the onboarding welcome screen.</summary>
    Task<bool> HasSeenOnboardingAsync();

    /// <summary>Persists a flag so returning visitors are sent to login instead of onboarding.</summary>
    Task MarkOnboardingSeenAsync();
}
