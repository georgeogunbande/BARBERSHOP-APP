using BarbershopApi.Common;
using BarbershopApi.Features.Clients.Entities;
using BarbershopApi.Infrastructure.Data;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BarbershopApi.Features.Clients.UpdateClient;

public sealed class UpdateClientHandler : IRequestHandler<UpdateClientCommand, Result<Client>>
{
    private readonly AppDbContext _db;

    public UpdateClientHandler(AppDbContext db)
    {
        _db = db;
    }

    public async Task<Result<Client>> Handle(UpdateClientCommand request, CancellationToken ct)
    {
        var client = await _db.Clients
            .FirstOrDefaultAsync(c => c.Id == request.Id && c.BarberShopId == request.BarberShopId, ct);

        if (client is null)
            return Result<Client>.NotFound($"Client {request.Id} not found.");

        client.Name = request.Name;
        client.Phone = request.Phone;
        client.Email = request.Email;
        client.Tags = request.Tags;
        client.Notes = request.Notes;

        await _db.SaveChangesAsync(ct);

        return Result<Client>.Ok(client);
    }
}
