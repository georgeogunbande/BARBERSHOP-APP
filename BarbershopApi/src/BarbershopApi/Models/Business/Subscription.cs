using BarbershopApi.Models.Enums;

namespace BarbershopApi.Models.Business;

public class Subscription
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid BusinessId { get; set; }
    public Business Business { get; set; } = null!;
    public SubscriptionPlan Plan { get; set; } = SubscriptionPlan.Starter;
    public string? StripeSubscriptionId { get; set; }
    public string? StripeCustomerId { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsTrialing { get; set; } = true;
    public DateTime? TrialEndsAt { get; set; } = DateTime.UtcNow.AddDays(14);
    public DateTime? CurrentPeriodStart { get; set; }
    public DateTime? CurrentPeriodEnd { get; set; }
    public DateTime? CancelledAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
