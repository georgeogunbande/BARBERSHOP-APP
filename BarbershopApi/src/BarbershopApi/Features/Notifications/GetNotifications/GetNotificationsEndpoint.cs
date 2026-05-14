using System.Security.Claims;
using Carter;
using MediatR;

namespace BarbershopApi.Features.Notifications.GetNotifications;

public sealed class GetNotificationsEndpoint : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapGet("/api/notifications", async (
            ISender sender,
            ClaimsPrincipal user,
            bool? unreadOnly = null) =>
        {
            var barbershopId = Guid.Parse(user.FindFirstValue("barbershop_id")!);
            var result = await sender.Send(new GetNotificationsQuery(barbershopId, unreadOnly));
            return result.IsSuccess ? Results.Ok(result.Value) : Results.BadRequest(result.Error);
        })
        .RequireAuthorization()
        .WithTags("Notifications");
    }
}
