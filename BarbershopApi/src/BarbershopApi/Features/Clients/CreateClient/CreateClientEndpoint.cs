using System.Security.Claims;
using Carter;
using MediatR;

namespace BarbershopApi.Features.Clients.CreateClient;

public sealed class CreateClientEndpoint : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/clients", async (CreateClientRequest request, ISender sender, ClaimsPrincipal user) =>
        {
            var barbershopId = Guid.Parse(user.FindFirstValue("barbershop_id")!);
            var command = new CreateClientCommand(
                barbershopId,
                request.Name,
                request.Phone,
                request.Email,
                request.Tags,
                request.Notes);

            var result = await sender.Send(command);
            return result.IsSuccess
                ? Results.Created($"/api/clients/{result.Value!.Id}", result.Value)
                : Results.BadRequest(result.Error);
        })
        .RequireAuthorization()
        .WithTags("Clients");
    }
}

public sealed record CreateClientRequest(
    string Name,
    string Phone,
    string Email,
    string Tags,
    string Notes
);
