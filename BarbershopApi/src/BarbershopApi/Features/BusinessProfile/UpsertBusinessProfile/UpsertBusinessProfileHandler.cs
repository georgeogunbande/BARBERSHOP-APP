using BarbershopApi.Common;
using BarbershopApi.Infrastructure.Data;
using MediatR;
using Microsoft.EntityFrameworkCore;
using BizProfile = BarbershopApi.Features.BusinessProfile.Entities.BusinessProfile;

namespace BarbershopApi.Features.BusinessProfile.UpsertBusinessProfile;

public sealed class UpsertBusinessProfileHandler : IRequestHandler<UpsertBusinessProfileCommand, Result<BizProfile>>
{
    private readonly AppDbContext _db;

    public UpsertBusinessProfileHandler(AppDbContext db)
    {
        _db = db;
    }

    public async Task<Result<BizProfile>> Handle(UpsertBusinessProfileCommand request, CancellationToken ct)
    {
        var profile = await _db.BusinessProfiles
            .FirstOrDefaultAsync(p => p.BarberShopId == request.BarberShopId, ct);

        if (profile is null)
        {
            profile = new BizProfile
            {
                Id = Guid.NewGuid(),
                BarberShopId = request.BarberShopId
            };
            _db.BusinessProfiles.Add(profile);
        }

        profile.Name = request.Name;
        profile.Address = request.Address;
        profile.Phone = request.Phone;
        profile.Email = request.Email;
        profile.Website = request.Website;
        profile.BookingLinkSlug = request.BookingLinkSlug;
        profile.LogoUrl = request.LogoUrl;
        profile.WorkingHoursJson = string.IsNullOrEmpty(request.WorkingHoursJson) ? "{}" : request.WorkingHoursJson;
        profile.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        return Result<BizProfile>.Ok(profile);
    }
}
