using BarbershopApi.Common;
using BarbershopApi.Features.Clients.Entities;
using MediatR;

namespace BarbershopApi.Features.Clients.GetClients;

public sealed record GetClientsQuery(
    Guid BarberShopId
) : IRequest<Result<IReadOnlyList<Client>>>;
