using BarbershopApi.Common;
using BarbershopApi.Features.Services.Entities;
using BarbershopApi.Infrastructure.Data;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BarbershopApi.Features.Services.UpdateService;

public sealed class UpdateServiceHandler : IRequestHandler<UpdateServiceCommand, Result<Service>>
{
    private readonly AppDbContext _db;

    public UpdateServiceHandler(AppDbContext db)
    {
        _db = db;
    }

    public async Task<Result<Service>> Handle(UpdateServiceCommand request, CancellationToken ct)
    {
        var service = await _db.Services
            .FirstOrDefaultAsync(s => s.Id == request.Id && s.BarberShopId == request.BarberShopId, ct);

        if (service is null)
            return Result<Service>.NotFound($"Service {request.Id} not found.");

        service.Name = request.Name;
        service.Description = request.Description;
        service.Price = request.Price;
        service.DurationMinutes = request.DurationMinutes;
        service.Category = request.Category;
        service.IsActive = request.IsActive;

        await _db.SaveChangesAsync(ct);

        return Result<Service>.Ok(service);
    }
}
