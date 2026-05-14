using BarbershopApi.Common;
using BarbershopApi.Features.Appointments.Entities;
using MediatR;

namespace BarbershopApi.Features.Appointments.CancelAppointment;

public sealed record CancelAppointmentCommand(
    Guid Id,
    Guid BarberShopId
) : IRequest<Result<Appointment>>;
