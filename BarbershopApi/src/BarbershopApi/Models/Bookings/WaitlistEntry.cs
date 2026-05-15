namespace BarbershopApi.Models.Bookings;

public class WaitlistEntry
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid BusinessId { get; set; }
    public Guid ClientId { get; set; }
    public Guid ServiceId { get; set; }
    public Guid? PreferredStaffId { get; set; }
    public DateTime PreferredDateStart { get; set; }
    public DateTime PreferredDateEnd { get; set; }
    public bool IsNotified { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
