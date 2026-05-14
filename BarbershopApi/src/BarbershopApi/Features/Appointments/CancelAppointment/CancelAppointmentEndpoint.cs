using System.Security.Claims;
using Carter;
using MediatR;

namespace BarbershopApi.Features.Appointments.CancelAppointment;

public sealed class CancelAppointmentEndpoint : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/appointments/{id:guid}/cancel", async (Guid id, ISender sender, ClaimsPrincipal user) =>
        {
            var barbershopId = Guid.Parse(user.FindFirstValue("barbershop_id")!);
            var result = await sender.Send(new CancelAppointmentCommand(id, barbershopId));
            return result.IsSuccess
                ? Results.Ok(result.Value)
                : result.IsNotFound ? Results.NotFound(result.Error) : Results.BadRequest(result.Error);
        })
        .RequireAuthorization()
        .WithTags("Appointments");
    }
}
