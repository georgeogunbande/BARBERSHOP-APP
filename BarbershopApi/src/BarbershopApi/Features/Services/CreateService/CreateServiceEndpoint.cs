using System.Security.Claims;
using Carter;
using MediatR;

namespace BarbershopApi.Features.Services.CreateService;

public sealed class CreateServiceEndpoint : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/services", async (CreateServiceRequest request, ISender sender, ClaimsPrincipal user) =>
        {
            var barbershopId = Guid.Parse(user.FindFirstValue("barbershop_id")!);
            var command = new CreateServiceCommand(
                barbershopId,
                request.Name,
                request.Description,
                request.Price,
                request.DurationMinutes,
                request.Category);

            var result = await sender.Send(command);
            return result.IsSuccess
                ? Results.Created($"/api/services/{result.Value!.Id}", result.Value)
                : Results.BadRequest(result.Error);
        })
        .RequireAuthorization()
        .WithTags("Services");
    }
}

public sealed record CreateServiceRequest(
    string Name,
    string Description,
    decimal Price,
    int DurationMinutes,
    string Category
);
