using BarbershopApi.Common;
using BarbershopApi.Features.Services.Entities;
using MediatR;

namespace BarbershopApi.Features.Services.GetServices;

public sealed record GetServicesQuery(
    Guid BarberShopId
) : IRequest<Result<IReadOnlyList<Service>>>;
