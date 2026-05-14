using BarbershopApi.Common;
using BarbershopApi.Features.Clients.Entities;
using BarbershopApi.Infrastructure.Data;
using MediatR;

namespace BarbershopApi.Features.Clients.CreateClient;

public sealed class CreateClientHandler : IRequestHandler<CreateClientCommand, Result<Client>>
{
    private readonly AppDbContext _db;

    public CreateClientHandler(AppDbContext db)
    {
        _db = db;
    }

    public async Task<Result<Client>> Handle(CreateClientCommand request, CancellationToken ct)
    {
        var client = new Client
        {
            Id = Guid.NewGuid(),
            BarberShopId = request.BarberShopId,
            Name = request.Name,
            Phone = request.Phone,
            Email = request.Email,
            Tags = request.Tags,
            Notes = request.Notes,
            CreatedAt = DateTime.UtcNow
        };

        _db.Clients.Add(client);
        await _db.SaveChangesAsync(ct);

        return Result<Client>.Ok(client);
    }
}
