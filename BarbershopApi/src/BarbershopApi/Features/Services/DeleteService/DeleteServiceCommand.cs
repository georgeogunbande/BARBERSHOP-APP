using BarbershopApi.Common;
using MediatR;

namespace BarbershopApi.Features.Services.DeleteService;

public sealed record DeleteServiceCommand(
    Guid Id,
    Guid BarberShopId
) : IRequest<Result>;
