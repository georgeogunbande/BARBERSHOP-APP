using BarbershopApi.Common;
using BarbershopApi.Features.Notifications.Entities;
using BarbershopApi.Infrastructure.Data;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BarbershopApi.Features.Notifications.MarkNotificationRead;

public sealed class MarkNotificationReadHandler : IRequestHandler<MarkNotificationReadCommand, Result<Notification>>
{
    private readonly AppDbContext _db;

    public MarkNotificationReadHandler(AppDbContext db)
    {
        _db = db;
    }

    public async Task<Result<Notification>> Handle(MarkNotificationReadCommand request, CancellationToken ct)
    {
        var notification = await _db.Notifications
            .FirstOrDefaultAsync(n => n.Id == request.Id && n.BarberShopId == request.BarberShopId, ct);

        if (notification is null)
            return Result<Notification>.NotFound($"Notification {request.Id} not found.");

        notification.IsRead = true;
        await _db.SaveChangesAsync(ct);

        return Result<Notification>.Ok(notification);
    }
}
