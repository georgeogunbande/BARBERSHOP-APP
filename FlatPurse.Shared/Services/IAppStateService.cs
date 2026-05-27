using FlatPurse.Models;

namespace FlatPurse.Services;

public interface IAppStateService
{
    UserDto? CurrentUser { get; }
    bool IsAuthenticated { get; }
    event Action? OnChange;
    void SetUser(UserDto? user);
}
