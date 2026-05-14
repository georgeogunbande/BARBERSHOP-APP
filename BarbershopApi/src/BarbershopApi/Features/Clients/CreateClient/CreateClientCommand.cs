using BarbershopApi.Common;
using BarbershopApi.Features.Clients.Entities;
using MediatR;

namespace BarbershopApi.Features.Clients.CreateClient;

public sealed record CreateClientCommand(
    Guid BarberShopId,
    string Name,
    string Phone,
    string Email,
    string Tags,
    string Notes
) : IRequest<Result<Client>>;
