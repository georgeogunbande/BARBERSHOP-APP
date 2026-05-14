using BarbershopApi.Common;
using BarbershopApi.Features.Clients.Entities;
using BarbershopApi.Infrastructure.Data;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BarbershopApi.Features.Clients.GetClientById;

public sealed class GetClientByIdHandler : IRequestHandler<GetClientByIdQuery, Result<Client>>
{
    private readonly AppDbContext _db;

    public GetClientByIdHandler(AppDbContext db)
    {
        _db = db;
    }

    public async Task<Result<Client>> Handle(GetClientByIdQuery request, CancellationToken ct)
    {
        var client = await _db.Clients
            .FirstOrDefaultAsync(c => c.Id == request.Id && c.BarberShopId == request.BarberShopId, ct);

        if (client is null)
            return Result<Client>.NotFound($"Client {request.Id} not found.");

        return Result<Client>.Ok(client);
    }
}
