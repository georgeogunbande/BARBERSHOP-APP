using FlatPurse.Models;

namespace FlatPurse.Services;

public interface IAuthService
{
    Task<bool> LoginAsync(string email, string password);
    Task<bool> RegisterAsync(RegisterRequest req);
    Task LogoutAsync();
    Task<bool> TryRestoreSessionAsync();
}
