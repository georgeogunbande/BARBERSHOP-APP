using BarbershopApi.Common;
using BarbershopApi.Features.Services.Entities;
using BarbershopApi.Infrastructure.Data;
using MediatR;

namespace BarbershopApi.Features.Services.CreateService;

public sealed class CreateServiceHandler : IRequestHandler<CreateServiceCommand, Result<Service>>
{
    private readonly AppDbContext _db;

    public CreateServiceHandler(AppDbContext db)
    {
        _db = db;
    }

    public async Task<Result<Service>> Handle(CreateServiceCommand request, CancellationToken ct)
    {
        var service = new Service
        {
            Id = Guid.NewGuid(),
            BarberShopId = request.BarberShopId,
            Name = request.Name,
            Description = request.Description,
            Price = request.Price,
            DurationMinutes = request.DurationMinutes,
            Category = request.Category,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _db.Services.Add(service);
        await _db.SaveChangesAsync(ct);

        return Result<Service>.Ok(service);
    }
}
