using BarbershopApi.Common;
using BarbershopApi.Features.Notifications.Entities;
using BarbershopApi.Infrastructure.Data;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BarbershopApi.Features.Notifications.GetNotifications;

public sealed class GetNotificationsHandler : IRequestHandler<GetNotificationsQuery, Result<IReadOnlyList<Notification>>>
{
    private readonly AppDbContext _db;

    public GetNotificationsHandler(AppDbContext db)
    {
        _db = db;
    }

    public async Task<Result<IReadOnlyList<Notification>>> Handle(GetNotificationsQuery request, CancellationToken ct)
    {
        var query = _db.Notifications.Where(n => n.BarberShopId == request.BarberShopId);

        if (request.UnreadOnly == true)
            query = query.Where(n => !n.IsRead);

        var notifications = await query
            .OrderByDescending(n => n.CreatedAt)
            .ToListAsync(ct);

        return Result<IReadOnlyList<Notification>>.Ok(notifications);
    }
}
