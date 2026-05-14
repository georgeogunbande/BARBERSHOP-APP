using BarbershopApi.Common;
using BarbershopApi.Features.Appointments.Entities;
using MediatR;

namespace BarbershopApi.Features.Appointments.GetAppointments;

public sealed record GetAppointmentsQuery(
    Guid BarberShopId,
    DateTime? From = null,
    DateTime? To = null
) : IRequest<Result<IReadOnlyList<Appointment>>>;
