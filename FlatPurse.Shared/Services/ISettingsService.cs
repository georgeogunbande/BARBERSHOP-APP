using FlatPurse.Models;

namespace FlatPurse.Services;

public interface ISettingsService
{
    Task<BusinessSettingsDto?> GetSettingsAsync();
    Task<BusinessSettingsDto?> UpdateSettingsAsync(UpdateBusinessProfileRequest req);
    Task<SubscriptionDto?> GetSubscriptionAsync();
    Task<IEnumerable<ChannelDto>?> GetChannelsAsync();
}
