using BarbershopApi.Common;
using BarbershopApi.Infrastructure.Data;
using MediatR;
using Microsoft.EntityFrameworkCore;
using BizProfile = BarbershopApi.Features.BusinessProfile.Entities.BusinessProfile;

namespace BarbershopApi.Features.BusinessProfile.GetBusinessProfile;

public sealed class GetBusinessProfileHandler : IRequestHandler<GetBusinessProfileQuery, Result<BizProfile>>
{
    private readonly AppDbContext _db;

    public GetBusinessProfileHandler(AppDbContext db)
    {
        _db = db;
    }

    public async Task<Result<BizProfile>> Handle(GetBusinessProfileQuery request, CancellationToken ct)
    {
        var profile = await _db.BusinessProfiles
            .FirstOrDefaultAsync(p => p.BarberShopId == request.BarberShopId, ct);

        if (profile is null)
            return Result<BizProfile>.NotFound("Business profile not found.");

        return Result<BizProfile>.Ok(profile);
    }
}
