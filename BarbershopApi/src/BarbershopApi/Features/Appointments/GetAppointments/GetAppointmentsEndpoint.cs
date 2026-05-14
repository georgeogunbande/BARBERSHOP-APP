using System.Security.Claims;
using Carter;
using MediatR;

namespace BarbershopApi.Features.Appointments.GetAppointments;

public sealed class GetAppointmentsEndpoint : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapGet("/api/appointments", async (
            ISender sender,
            ClaimsPrincipal user,
            DateTime? from = null,
            DateTime? to = null) =>
        {
            var barbershopId = Guid.Parse(user.FindFirstValue("barbershop_id")!);
            var result = await sender.Send(new GetAppointmentsQuery(barbershopId, from, to));
            return result.IsSuccess ? Results.Ok(result.Value) : Results.BadRequest(result.Error);
        })
        .RequireAuthorization()
        .WithTags("Appointments");
    }
}
