namespace BarbershopApi.Models.Payments;

public class SavedPaymentMethod
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid BusinessId { get; set; }
    public Guid ClientId { get; set; }
    public string StripePaymentMethodId { get; set; } = string.Empty;
    public string Brand { get; set; } = string.Empty;
    public string Last4 { get; set; } = string.Empty;
    public int ExpMonth { get; set; }
    public int ExpYear { get; set; }
    public bool IsDefault { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
