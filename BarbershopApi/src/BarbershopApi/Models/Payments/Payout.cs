namespace BarbershopApi.Models.Payments;

public class Payout
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid BusinessId { get; set; }
    public string StripePayoutId { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "CAD";
    public string Status { get; set; } = string.Empty;
    public DateTime? ArrivalDate { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
