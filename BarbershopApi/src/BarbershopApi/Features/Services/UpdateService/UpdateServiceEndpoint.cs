using System.Security.Claims;
using Carter;
using MediatR;

namespace BarbershopApi.Features.Services.UpdateService;

public sealed class UpdateServiceEndpoint : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapPut("/api/services/{id:guid}", async (
            Guid id,
            UpdateServiceRequest request,
            ISender sender,
            ClaimsPrincipal user) =>
        {
            var barbershopId = Guid.Parse(user.FindFirstValue("barbershop_id")!);
            var command = new UpdateServiceCommand(
                id,
                barbershopId,
                request.Name,
                request.Description,
                request.Price,
                request.DurationMinutes,
                request.Category,
                request.IsActive);

            var result = await sender.Send(command);
            return result.IsSuccess
                ? Results.Ok(result.Value)
                : result.IsNotFound ? Results.NotFound(result.Error) : Results.BadRequest(result.Error);
        })
        .RequireAuthorization()
        .WithTags("Services");
    }
}

public sealed record UpdateServiceRequest(
    string Name,
    string Description,
    decimal Price,
    int DurationMinutes,
    string Category,
    bool IsActive
);
