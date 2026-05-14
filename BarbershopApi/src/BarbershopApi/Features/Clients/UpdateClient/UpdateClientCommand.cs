using BarbershopApi.Common;
using BarbershopApi.Features.Clients.Entities;
using MediatR;

namespace BarbershopApi.Features.Clients.UpdateClient;

public sealed record UpdateClientCommand(
    Guid Id,
    Guid BarberShopId,
    string Name,
    string Phone,
    string Email,
    string Tags,
    string Notes
) : IRequest<Result<Client>>;
