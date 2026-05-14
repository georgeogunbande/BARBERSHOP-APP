using BarbershopApi.Common;
using BarbershopApi.Features.Services.Entities;
using MediatR;

namespace BarbershopApi.Features.Services.UpdateService;

public sealed record UpdateServiceCommand(
    Guid Id,
    Guid BarberShopId,
    string Name,
    string Description,
    decimal Price,
    int DurationMinutes,
    string Category,
    bool IsActive
) : IRequest<Result<Service>>;
