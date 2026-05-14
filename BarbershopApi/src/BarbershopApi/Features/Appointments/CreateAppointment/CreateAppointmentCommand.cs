using BarbershopApi.Common;
using BarbershopApi.Features.Appointments.Entities;
using MediatR;

namespace BarbershopApi.Features.Appointments.CreateAppointment;

public sealed record CreateAppointmentCommand(
    Guid BarberShopId,
    Guid ClientId,
    Guid StaffMemberId,
    Guid ServiceId,
    DateTime ScheduledAt,
    int DurationMinutes,
    decimal Price,
    string Notes
) : IRequest<Result<Appointment>>;
