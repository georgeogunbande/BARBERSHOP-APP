using System.Security.Claims;
using Carter;
using MediatR;

namespace BarbershopApi.Features.Notifications.MarkNotificationRead;

public sealed class MarkNotificationReadEndpoint : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/notifications/{id:guid}/read", async (Guid id, ISender sender, ClaimsPrincipal user) =>
        {
            var barbershopId = Guid.Parse(user.FindFirstValue("barbershop_id")!);
            var result = await sender.Send(new MarkNotificationReadCommand(id, barbershopId));
            return result.IsSuccess
                ? Results.Ok(result.Value)
                : Results.NotFound(result.Error);
        })
        .RequireAuthorization()
        .WithTags("Notifications");
    }
}
