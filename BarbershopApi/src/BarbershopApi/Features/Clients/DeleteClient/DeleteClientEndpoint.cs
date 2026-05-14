using System.Security.Claims;
using Carter;
using MediatR;

namespace BarbershopApi.Features.Clients.DeleteClient;

public sealed class DeleteClientEndpoint : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapDelete("/api/clients/{id:guid}", async (Guid id, ISender sender, ClaimsPrincipal user) =>
        {
            var barbershopId = Guid.Parse(user.FindFirstValue("barbershop_id")!);
            var result = await sender.Send(new DeleteClientCommand(id, barbershopId));
            return result.IsSuccess ? Results.NoContent() : Results.NotFound(result.Error);
        })
        .RequireAuthorization()
        .WithTags("Clients");
    }
}
