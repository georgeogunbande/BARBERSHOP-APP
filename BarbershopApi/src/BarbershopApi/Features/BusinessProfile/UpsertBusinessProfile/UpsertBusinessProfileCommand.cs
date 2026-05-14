using BarbershopApi.Common;
using MediatR;
using BizProfile = BarbershopApi.Features.BusinessProfile.Entities.BusinessProfile;

namespace BarbershopApi.Features.BusinessProfile.UpsertBusinessProfile;

public sealed record UpsertBusinessProfileCommand(
    Guid BarberShopId,
    string Name,
    string Address,
    string Phone,
    string Email,
    string Website,
    string BookingLinkSlug,
    string LogoUrl,
    string WorkingHoursJson
) : IRequest<Result<BizProfile>>;
