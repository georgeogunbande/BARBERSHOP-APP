using BarbershopApi.Common;
using BarbershopApi.Features.Notifications.Entities;
using MediatR;

namespace BarbershopApi.Features.Notifications.MarkNotificationRead;

public sealed record MarkNotificationReadCommand(
    Guid Id,
    Guid BarberShopId
) : IRequest<Result<Notification>>;
