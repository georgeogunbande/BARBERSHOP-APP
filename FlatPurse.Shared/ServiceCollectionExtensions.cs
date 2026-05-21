using FlatPurse.Services;
using Microsoft.Extensions.DependencyInjection;

namespace FlatPurse;

public static class ServiceCollectionExtensions
{
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
}
