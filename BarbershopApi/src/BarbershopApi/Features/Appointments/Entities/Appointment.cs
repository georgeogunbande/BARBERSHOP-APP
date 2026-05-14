namespace BarbershopApi.Features.Appointments.Entities;

public sealed class Appointment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid BarberShopId { get; set; }
    public Guid ClientId { get; set; }
    public Guid StaffMemberId { get; set; }
    public Guid ServiceId { get; set; }
    public DateTime ScheduledAt { get; set; }
    public int DurationMinutes { get; set; }
    public AppointmentStatus Status { get; set; } = AppointmentStatus.Scheduled;
    public string Notes { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public decimal TipAmount { get; set; }
    public string? PaymentMethod { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
