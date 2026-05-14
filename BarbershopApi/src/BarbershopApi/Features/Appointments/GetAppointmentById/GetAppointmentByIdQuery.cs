using BarbershopApi.Common;
using BarbershopApi.Features.Appointments.Entities;
using MediatR;

namespace BarbershopApi.Features.Appointments.GetAppointmentById;

public sealed record GetAppointmentByIdQuery(
    Guid Id,
    Guid BarberShopId
) : IRequest<Result<Appointment>>;
