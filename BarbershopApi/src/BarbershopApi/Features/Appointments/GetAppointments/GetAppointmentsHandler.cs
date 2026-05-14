using BarbershopApi.Common;
using BarbershopApi.Features.Appointments.Entities;
using BarbershopApi.Infrastructure.Data;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BarbershopApi.Features.Appointments.GetAppointments;

public sealed class GetAppointmentsHandler : IRequestHandler<GetAppointmentsQuery, Result<IReadOnlyList<Appointment>>>
{
    private readonly AppDbContext _db;

    public GetAppointmentsHandler(AppDbContext db)
    {
        _db = db;
    }

    public async Task<Result<IReadOnlyList<Appointment>>> Handle(GetAppointmentsQuery request, CancellationToken ct)
    {
        var query = _db.Appointments.Where(a => a.BarberShopId == request.BarberShopId);

        if (request.From.HasValue)
            query = query.Where(a => a.ScheduledAt >= request.From.Value);

        if (request.To.HasValue)
            query = query.Where(a => a.ScheduledAt <= request.To.Value);

        var appointments = await query
            .OrderByDescending(a => a.ScheduledAt)
            .ToListAsync(ct);

        return Result<IReadOnlyList<Appointment>>.Ok(appointments);
    }
}
