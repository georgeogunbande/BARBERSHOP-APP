using BarbershopApi.Models.Enums;

namespace BarbershopApi.Models.Payments;

public class Payment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid BusinessId { get; set; }
    public Guid BookingId { get; set; }
    public Guid ClientId { get; set; }
    public decimal Amount { get; set; }
    public decimal TipAmount { get; set; } = 0;
    public decimal PlatformFee { get; set; } = 0;
    public decimal NetAmount { get; set; }
    public string Currency { get; set; } = "CAD";
    public PaymentStatus Status { get; set; } = PaymentStatus.Pending;
    public PaymentMethod Method { get; set; }
    public string? StripePaymentIntentId { get; set; }
    public string? StripeChargeId { get; set; }
    public string? StripeTransferId { get; set; }
    public string? PaymentLinkToken { get; set; }
    public bool IsDeposit { get; set; } = false;
    public decimal? RefundedAmount { get; set; }
    public string? RefundId { get; set; }
    public DateTime? RefundedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
