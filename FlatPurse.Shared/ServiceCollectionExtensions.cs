using FlatPurse.Services;
using Microsoft.Extensions.DependencyInjection;

namespace FlatPurse;

public static class ServiceCollectionExtensions
{
    /// <summary>Registers all shared app services.</summary>
    public static IServiceCollection AddFlatPurseServices(this IServiceCollection services, string apiBaseUrl)
    {
        services.AddScoped<IAppStateService, AppStateService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IClientService, ClientService>();
        services.AddScoped<IBookingService, BookingService>();
        services.AddScoped<IPaymentService, PaymentService>();
        services.AddScoped<IMessagingService, MessagingService>();
        services.AddScoped<IAutoPilotService, AutoPilotService>();
        services.AddScoped<IDashboardService, DashboardService>();
        services.AddScoped<IStaffService, StaffService>();
        services.AddScoped<ISettingsService, SettingsService>();
        services.AddScoped<IServiceCatalogService, ServiceCatalogService>();
        services.AddHttpClient<IApiService, ApiService>(c => c.BaseAddress = new Uri(apiBaseUrl));
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
