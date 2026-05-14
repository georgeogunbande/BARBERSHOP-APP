using BarbershopApi.Common;
using BarbershopApi.Features.Clients.Entities;
using BarbershopApi.Infrastructure.Data;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BarbershopApi.Features.Clients.GetClients;

public sealed class GetClientsHandler : IRequestHandler<GetClientsQuery, Result<IReadOnlyList<Client>>>
{
    private readonly AppDbContext _db;

    public GetClientsHandler(AppDbContext db)
    {
        _db = db;
    }

    public async Task<Result<IReadOnlyList<Client>>> Handle(GetClientsQuery request, CancellationToken ct)
    {
        var clients = await _db.Clients
            .Where(c => c.BarberShopId == request.BarberShopId)
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync(ct);

        return Result<IReadOnlyList<Client>>.Ok(clients);
    }
}
