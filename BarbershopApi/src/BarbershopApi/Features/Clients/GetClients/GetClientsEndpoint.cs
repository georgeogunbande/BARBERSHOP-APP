using System.Security.Claims;
using Carter;
using MediatR;

namespace BarbershopApi.Features.Clients.GetClients;

public sealed class GetClientsEndpoint : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapGet("/api/clients", async (ISender sender, ClaimsPrincipal user) =>
        {
            var barbershopId = Guid.Parse(user.FindFirstValue("barbershop_id")!);
            var result = await sender.Send(new GetClientsQuery(barbershopId));
            return result.IsSuccess ? Results.Ok(result.Value) : Results.NotFound(result.Error);
        })
        .RequireAuthorization()
        .WithTags("Clients");
    }
}
