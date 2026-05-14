using System.Security.Claims;
using Carter;
using MediatR;

namespace BarbershopApi.Features.Services.DeleteService;

public sealed class DeleteServiceEndpoint : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapDelete("/api/services/{id:guid}", async (Guid id, ISender sender, ClaimsPrincipal user) =>
        {
            var barbershopId = Guid.Parse(user.FindFirstValue("barbershop_id")!);
            var result = await sender.Send(new DeleteServiceCommand(id, barbershopId));
            return result.IsSuccess ? Results.NoContent() : Results.NotFound(result.Error);
        })
        .RequireAuthorization()
        .WithTags("Services");
    }
}
