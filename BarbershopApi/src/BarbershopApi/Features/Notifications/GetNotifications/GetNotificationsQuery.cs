using BarbershopApi.Common;
using BarbershopApi.Features.Notifications.Entities;
using MediatR;

namespace BarbershopApi.Features.Notifications.GetNotifications;

public sealed record GetNotificationsQuery(
    Guid BarberShopId,
    bool? UnreadOnly = null
) : IRequest<Result<IReadOnlyList<Notification>>>;
