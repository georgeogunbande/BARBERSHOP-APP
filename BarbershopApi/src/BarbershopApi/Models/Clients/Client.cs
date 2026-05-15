using BarbershopApi.Models.Enums;

namespace BarbershopApi.Models.Clients;

public class Client
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid BusinessId { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public DateTime? DateOfBirth { get; set; }
    public string? AvatarUrl { get; set; }
    public List<ClientTag> Tags { get; set; } = [];
    public ChurnRisk ChurnRisk { get; set; } = ChurnRisk.Low;
    public decimal LifetimeValue { get; set; } = 0;
    public int VisitCount { get; set; } = 0;
    public DateTime? LastVisitAt { get; set; }
    public DateTime? NextVisitDueAt { get; set; }
    public int RebookIntervalDays { get; set; } = 28;
    public string? StripeCustomerId { get; set; }
    public bool IsArchived { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<ClientNote> Notes { get; set; } = [];
    public ICollection<ClientDocument> Documents { get; set; } = [];

    public string FullName => $"{FirstName} {LastName}".Trim();
}
