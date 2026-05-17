using BarbershopApi.Models.Enums;

namespace BarbershopApi.Models.Bookings;

public class Booking
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid BusinessId { get; set; }
    public Guid ClientId { get; set; }
    public Guid ServiceId { get; set; }
    public Guid StaffMemberId { get; set; }
    public DateTime StartsAt { get; set; }
    public DateTime EndsAt { get; set; }
    public BookingStatus Status { get; set; } = BookingStatus.Pending;
    public string? Notes { get; set; }
    public decimal Price { get; set; }
    public decimal DepositAmount { get; set; } = 0;
    public bool DepositPaid { get; set; } = false;
    public string? DepositPaymentIntentId { get; set; }
    public string? InteracRefCode { get; set; }
    public DepositStatus DepositStatus { get; set; } = DepositStatus.None;
    public string? SlotLockToken { get; set; }
    public DateTime? SlotLockedUntil { get; set; }
    public bool IsPublicBooking { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
