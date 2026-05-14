using BarbershopApi.Common;
using BarbershopApi.Features.Appointments.Entities;
using BarbershopApi.Infrastructure.Data;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BarbershopApi.Features.Appointments.CompleteAppointment;

public sealed class CompleteAppointmentHandler : IRequestHandler<CompleteAppointmentCommand, Result<Appointment>>
{
    private readonly AppDbContext _db;

    public CompleteAppointmentHandler(AppDbContext db)
    {
        _db = db;
    }

    public async Task<Result<Appointment>> Handle(CompleteAppointmentCommand request, CancellationToken ct)
    {
        var appointment = await _db.Appointments
            .FirstOrDefaultAsync(a => a.Id == request.Id && a.BarberShopId == request.BarberShopId, ct);

        if (appointment is null)
            return Result<Appointment>.NotFound($"Appointment {request.Id} not found.");

        if (appointment.Status != AppointmentStatus.Scheduled)
            return Result<Appointment>.Fail($"Cannot complete an appointment with status '{appointment.Status}'.");

        appointment.Status = AppointmentStatus.Completed;
        appointment.TipAmount = request.TipAmount;
        appointment.PaymentMethod = request.PaymentMethod;

        var client = await _db.Clients.FindAsync([appointment.ClientId], ct);
        if (client is not null)
        {
            client.TotalVisits++;
            client.TotalSpent += appointment.Price + request.TipAmount;
            client.LastVisitAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync(ct);

        return Result<Appointment>.Ok(appointment);
    }
}
