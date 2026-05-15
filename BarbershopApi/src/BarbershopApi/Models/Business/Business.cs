namespace BarbershopApi.Models.Business;

public class Business
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string? City { get; set; }
    public string? Type { get; set; }
    public string? LogoUrl { get; set; }
    public string? CoverPhotoUrl { get; set; }
    public string? BookingHandle { get; set; }
    public string? ActiveTheme { get; set; } = "default";
    public string? AiPrompt { get; set; }
    public string? Currency { get; set; } = "CAD";
    public string? StripeAccountId { get; set; }
    public string? StripeBankAccountId { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<BusinessHours> Hours { get; set; } = [];
    public FamilyHoursConfig? FamilyHours { get; set; }
    public ICollection<BusinessMedia> Media { get; set; } = [];
    public Subscription? Subscription { get; set; }
}
