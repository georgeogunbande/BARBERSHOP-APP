using BarbershopApi.Models.Enums;

namespace BarbershopApi.Models.Messaging;

public class MessageTemplate
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid BusinessId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public MessageChannel Channel { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class MessagingLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid BusinessId { get; set; }
    public Guid? ClientId { get; set; }
    public MessageChannel Channel { get; set; }
    public string? To { get; set; }
    public string Body { get; set; } = string.Empty;
    public string? ExternalMessageId { get; set; }
    public string Status { get; set; } = "sent";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class BriefSettings
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid BusinessId { get; set; }
    public TimeOnly DeliveryTime { get; set; } = new TimeOnly(8, 0);
    public List<MessageChannel> Channels { get; set; } = [MessageChannel.Push];
    public bool IsEnabled { get; set; } = true;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
