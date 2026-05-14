using BarbershopApi.Models.Enums;

namespace BarbershopApi.Models.AI;

public class AiConversation
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid BusinessId { get; set; }
    public Guid? ClientId { get; set; }
    public string? ClientPhone { get; set; }
    public string? ClientEmail { get; set; }
    public MessageChannel Channel { get; set; }
    public AiConversationStatus Status { get; set; } = AiConversationStatus.Active;
    public string? HandedOffToUserId { get; set; }
    public DateTime? HandedOffAt { get; set; }
    public DateTime LastMessageAt { get; set; } = DateTime.UtcNow;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<AiConversationMessage> Messages { get; set; } = [];
}

public class AiConversationMessage
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ConversationId { get; set; }
    public AiConversation Conversation { get; set; } = null!;
    public bool IsFromClient { get; set; }
    public bool IsAiGenerated { get; set; }
    public string Content { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
