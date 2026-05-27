using FlatPurse.Models;

namespace FlatPurse.Services;

public class SettingsService : ISettingsService
{
    private readonly IApiService _api;

    public SettingsService(IApiService api) => _api = api;

    public Task<BusinessSettingsDto?> GetSettingsAsync() =>
        _api.GetAsync<BusinessSettingsDto>("settings");

    public Task<BusinessSettingsDto?> UpdateSettingsAsync(UpdateBusinessProfileRequest req) =>
        _api.PostAsync<BusinessSettingsDto>("settings", req);

    public Task<SubscriptionDto?> GetSubscriptionAsync() =>
        _api.GetAsync<SubscriptionDto>("settings/subscription");

    public Task<IEnumerable<ChannelDto>?> GetChannelsAsync() =>
        _api.GetAsync<IEnumerable<ChannelDto>>("channels");
}
