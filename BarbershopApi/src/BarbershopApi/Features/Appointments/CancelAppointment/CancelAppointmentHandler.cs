using BarbershopApi.Common;
using BarbershopApi.Features.Appointments.Entities;
using BarbershopApi.Infrastructure.Data;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BarbershopApi.Features.Appointments.CancelAppointment;

public sealed class CancelAppointmentHandler : IRequestHandler<CancelAppointmentCommand, Result<Appointment>>
{
    private readonly AppDbContext _db;

    public CancelAppointmentHandler(AppDbContext db)
    {
        _db = db;
    }

    public async Task<Result<Appointment>> Handle(CancelAppointmentCommand request, CancellationToken ct)
    {
        var appointment = await _db.Appointments
            .FirstOrDefaultAsync(a => a.Id == request.Id && a.BarberShopId == request.BarberShopId, ct);

        if (appointment is null)
            return Result<Appointment>.NotFound($"Appointment {request.Id} not found.");

        if (appointment.Status == AppointmentStatus.Completed)
            return Result<Appointment>.Fail("Cannot cancel a completed appointment.");

        appointment.Status = AppointmentStatus.Cancelled;
        await _db.SaveChangesAsync(ct);

        return Result<Appointment>.Ok(appointment);
    }
}
