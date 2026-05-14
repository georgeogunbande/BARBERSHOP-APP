using BarbershopApi.Common;
using BarbershopApi.Features.Appointments.Entities;
using BarbershopApi.Infrastructure.Data;
using MediatR;

namespace BarbershopApi.Features.Appointments.CreateAppointment;

public sealed class CreateAppointmentHandler : IRequestHandler<CreateAppointmentCommand, Result<Appointment>>
{
    private readonly AppDbContext _db;

    public CreateAppointmentHandler(AppDbContext db)
    {
        _db = db;
    }

    public async Task<Result<Appointment>> Handle(CreateAppointmentCommand request, CancellationToken ct)
    {
        var appointment = new Appointment
        {
            Id = Guid.NewGuid(),
            BarberShopId = request.BarberShopId,
            ClientId = request.ClientId,
            StaffMemberId = request.StaffMemberId,
            ServiceId = request.ServiceId,
            ScheduledAt = request.ScheduledAt,
            DurationMinutes = request.DurationMinutes,
            Price = request.Price,
            Notes = request.Notes,
            Status = AppointmentStatus.Scheduled,
            CreatedAt = DateTime.UtcNow
        };

        _db.Appointments.Add(appointment);
        await _db.SaveChangesAsync(ct);

        return Result<Appointment>.Ok(appointment);
    }
}
