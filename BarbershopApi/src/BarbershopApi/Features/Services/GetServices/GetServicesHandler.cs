using BarbershopApi.Common;
using BarbershopApi.Features.Services.Entities;
using BarbershopApi.Infrastructure.Data;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BarbershopApi.Features.Services.GetServices;

public sealed class GetServicesHandler : IRequestHandler<GetServicesQuery, Result<IReadOnlyList<Service>>>
{
    private readonly AppDbContext _db;

    public GetServicesHandler(AppDbContext db)
    {
        _db = db;
    }

    public async Task<Result<IReadOnlyList<Service>>> Handle(GetServicesQuery request, CancellationToken ct)
    {
        var services = await _db.Services
            .Where(s => s.BarberShopId == request.BarberShopId)
            .OrderBy(s => s.Category)
            .ThenBy(s => s.Name)
            .ToListAsync(ct);

        return Result<IReadOnlyList<Service>>.Ok(services);
    }
}
