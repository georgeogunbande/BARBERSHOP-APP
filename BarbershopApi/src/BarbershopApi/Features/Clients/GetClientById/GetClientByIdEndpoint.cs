using System.Security.Claims;
using Carter;
using MediatR;

namespace BarbershopApi.Features.Clients.GetClientById;

public sealed class GetClientByIdEndpoint : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapGet("/api/clients/{id:guid}", async (Guid id, ISender sender, ClaimsPrincipal user) =>
        {
            var barbershopId = Guid.Parse(user.FindFirstValue("barbershop_id")!);
            var result = await sender.Send(new GetClientByIdQuery(id, barbershopId));
            return result.IsSuccess ? Results.Ok(result.Value) : Results.NotFound(result.Error);
        })
        .RequireAuthorization()
        .WithTags("Clients");
    }
}
