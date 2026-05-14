using BarbershopApi.Common;
using BarbershopApi.Infrastructure.Data;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BarbershopApi.Features.Services.DeleteService;

public sealed class DeleteServiceHandler : IRequestHandler<DeleteServiceCommand, Result>
{
    private readonly AppDbContext _db;

    public DeleteServiceHandler(AppDbContext db)
    {
        _db = db;
    }

    public async Task<Result> Handle(DeleteServiceCommand request, CancellationToken ct)
    {
        var service = await _db.Services
            .FirstOrDefaultAsync(s => s.Id == request.Id && s.BarberShopId == request.BarberShopId, ct);

        if (service is null)
            return Result.NotFound($"Service {request.Id} not found.");

        _db.Services.Remove(service);
        await _db.SaveChangesAsync(ct);

        return Result.Ok();
    }
}
