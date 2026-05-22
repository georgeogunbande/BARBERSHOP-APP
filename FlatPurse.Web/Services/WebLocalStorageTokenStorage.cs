using FlatPurse.Services;
using Microsoft.JSInterop;

namespace FlatPurse.Web.Services;

public class WebLocalStorageTokenStorage : ITokenStorage
{
    private readonly IJSRuntime _js;

    public WebLocalStorageTokenStorage(IJSRuntime js)
    {
        _js = js;
    }

    public async Task<string?> GetTokenAsync()
    {
        try
        {
            return await _js.InvokeAsync<string?>("localStorage.getItem", "access_token");
        }
        catch
        {
            return null;
        }
    }

    public async Task SetTokenAsync(string token)
    {
        try
        {
            await _js.InvokeVoidAsync("localStorage.setItem", "access_token", token);
        }
        catch { /* prerendering */ }
    }

    public async Task ClearTokenAsync()
    {
        try
        {
            await _js.InvokeVoidAsync("localStorage.removeItem", "access_token");
        }
        catch { /* prerendering */ }
    }
}
