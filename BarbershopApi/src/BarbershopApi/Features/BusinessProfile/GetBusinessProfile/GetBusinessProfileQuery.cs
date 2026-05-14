using BarbershopApi.Common;
using MediatR;
using BizProfile = BarbershopApi.Features.BusinessProfile.Entities.BusinessProfile;

namespace BarbershopApi.Features.BusinessProfile.GetBusinessProfile;

public sealed record GetBusinessProfileQuery(
    Guid BarberShopId
) : IRequest<Result<BizProfile>>;
