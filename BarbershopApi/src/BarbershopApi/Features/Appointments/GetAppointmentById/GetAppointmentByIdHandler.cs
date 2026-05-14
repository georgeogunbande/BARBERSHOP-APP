using BarbershopApi.Common;
using BarbershopApi.Features.Appointments.Entities;
using BarbershopApi.Infrastructure.Data;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BarbershopApi.Features.Appointments.GetAppointmentById;

public sealed class GetAppointmentByIdHandler : IRequestHandler<GetAppointmentByIdQuery, Result<Appointment>>
{
    private readonly AppDbContext _db;

    public GetAppointmentByIdHandler(AppDbContext db)
    {
        _db = db;
    }

    public async Task<Result<Appointment>> Handle(GetAppointmentByIdQuery request, CancellationToken ct)
    {
        var appointment = await _db.Appointments
            .FirstOrDefaultAsync(a => a.Id == request.Id && a.BarberShopId == request.BarberShopId, ct);

        if (appointment is null)
            return Result<Appointment>.NotFound($"Appointment {request.Id} not found.");

        return Result<Appointment>.Ok(appointment);
    }
}
