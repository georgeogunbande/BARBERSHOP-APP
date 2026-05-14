using BarbershopApi.Common;
using BarbershopApi.Features.Clients.Entities;
using MediatR;

namespace BarbershopApi.Features.Clients.GetClientById;

public sealed record GetClientByIdQuery(
    Guid Id,
    Guid BarberShopId
) : IRequest<Result<Client>>;
