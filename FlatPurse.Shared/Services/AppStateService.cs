using FlatPurse.Models;

namespace FlatPurse.Services;

public class AppStateService
{
    public UserDto? CurrentUser { get; private set; }
    public bool IsAuthenticated => CurrentUser != null;
    public event Action? OnChange;

    public void SetUser(UserDto? user)
    {
        CurrentUser = user;
        OnChange?.Invoke();
    }
}
