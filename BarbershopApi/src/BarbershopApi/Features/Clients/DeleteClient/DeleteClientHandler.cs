using BarbershopApi.Common;
using BarbershopApi.Infrastructure.Data;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BarbershopApi.Features.Clients.DeleteClient;

public sealed class DeleteClientHandler : IRequestHandler<DeleteClientCommand, Result>
{
    private readonly AppDbContext _db;

    public DeleteClientHandler(AppDbContext db)
    {
        _db = db;
    }

    public async Task<Result> Handle(DeleteClientCommand request, CancellationToken ct)
    {
        var client = await _db.Clients
            .FirstOrDefaultAsync(c => c.Id == request.Id && c.BarberShopId == request.BarberShopId, ct);

        if (client is null)
            return Result.NotFound($"Client {request.Id} not found.");

        _db.Clients.Remove(client);
        await _db.SaveChangesAsync(ct);

        return Result.Ok();
    }
}
