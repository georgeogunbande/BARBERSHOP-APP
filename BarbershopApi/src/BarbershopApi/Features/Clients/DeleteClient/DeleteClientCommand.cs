using BarbershopApi.Common;
using MediatR;

namespace BarbershopApi.Features.Clients.DeleteClient;

public sealed record DeleteClientCommand(
    Guid Id,
    Guid BarberShopId
) : IRequest<Result>;
