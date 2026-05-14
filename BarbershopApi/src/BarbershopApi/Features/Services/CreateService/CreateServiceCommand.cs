using BarbershopApi.Common;
using BarbershopApi.Features.Services.Entities;
using MediatR;

namespace BarbershopApi.Features.Services.CreateService;

public sealed record CreateServiceCommand(
    Guid BarberShopId,
    string Name,
    string Description,
    decimal Price,
    int DurationMinutes,
    string Category
) : IRequest<Result<Service>>;
