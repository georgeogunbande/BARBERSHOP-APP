using System.Security.Claims;
using Carter;
using MediatR;

namespace BarbershopApi.Features.Clients.UpdateClient;

public sealed class UpdateClientEndpoint : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapPut("/api/clients/{id:guid}", async (Guid id, UpdateClientRequest request, ISender sender, ClaimsPrincipal user) =>
        {
            var barbershopId = Guid.Parse(user.FindFirstValue("barbershop_id")!);
            var command = new UpdateClientCommand(
                id,
                barbershopId,
                request.Name,
                request.Phone,
                request.Email,
                request.Tags,
                request.Notes);

            var result = await sender.Send(command);
            return result.IsSuccess
                ? Results.Ok(result.Value)
                : result.IsNotFound ? Results.NotFound(result.Error) : Results.BadRequest(result.Error);
        })
        .RequireAuthorization()
        .WithTags("Clients");
    }
}

public sealed record UpdateClientRequest(
    string Name,
    string Phone,
    string Email,
    string Tags,
    string Notes
);
