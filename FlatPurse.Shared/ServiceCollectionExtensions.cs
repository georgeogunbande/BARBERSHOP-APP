using FlatPurse.Services;
using Microsoft.Extensions.DependencyInjection;

namespace FlatPurse;

public static class ServiceCollectionExtensions
{
    /// <summary>Registers all shared app services.</summary>
    public static IServiceCollection AddFlatPurseServices(this IServiceCollection services, string apiBaseUrl)
    {
        services.AddScoped<AppStateService>();
        services.AddScoped<AuthService>();
        services.AddScoped<ClientService>();
        services.AddScoped<BookingService>();
        services.AddScoped<PaymentService>();
        services.AddScoped<MessagingService>();
        services.AddScoped<AutoPilotService>();
        services.AddScoped<DashboardService>();
        services.AddHttpClient<ApiService>(c => c.BaseAddress = new Uri(apiBaseUrl));
        return services;
    }

    /// <summary>Registers services for the Blazor WebAssembly (PublicWebs) host.</summary>
    public static IServiceCollection AddFlatPurseWebServices(this IServiceCollection services, string apiBaseUrl)
    {
        services.AddScoped<ITokenStorage, LocalStorageTokenStorage>();
        services.AddFlatPurseServices(apiBaseUrl);
        return services;
    }
}
