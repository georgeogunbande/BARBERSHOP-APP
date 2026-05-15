using BarbershopApi.Models.Enums;

namespace BarbershopApi.Models.Channels;

public class Channel
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid BusinessId { get; set; }
    public ChannelType Type { get; set; }
    public ChannelStatus Status { get; set; } = ChannelStatus.Disconnected;
    public string? AccessToken { get; set; }
    public string? RefreshToken { get; set; }
    public string? ExternalAccountId { get; set; }
    public string? ExternalAccountName { get; set; }
    public string? WebhookUrl { get; set; }
    public DateTime? ConnectedAt { get; set; }
    public DateTime? TokenExpiresAt { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
