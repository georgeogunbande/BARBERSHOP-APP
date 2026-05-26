using FlatPurse.Mobile.Services;
using FlatPurse.Services;
using Microsoft.Extensions.DependencyInjection;

namespace FlatPurse.Mobile;

public static class MobileServiceExtensions
{
    /// <summary>Registers services for the .NET MAUI (Mobile) host.</summary>
    public static IServiceCollection AddFlatPurseMobileServices(this IServiceCollection services, string apiBaseUrl)
    {
        services.AddScoped<ITokenStorage, SecureStorageTokenStorage>();
        services.AddFlatPurseServices(apiBaseUrl);
        return services;
    }
}
