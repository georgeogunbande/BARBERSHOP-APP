using BarbershopApi.Common;
using BarbershopApi.Features.Appointments.Entities;
using MediatR;

namespace BarbershopApi.Features.Appointments.CompleteAppointment;

public sealed record CompleteAppointmentCommand(
    Guid Id,
    Guid BarberShopId,
    decimal TipAmount,
    string PaymentMethod
) : IRequest<Result<Appointment>>;
