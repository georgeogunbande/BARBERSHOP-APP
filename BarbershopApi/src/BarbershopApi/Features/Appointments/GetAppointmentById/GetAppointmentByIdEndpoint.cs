using System.Security.Claims;
using Carter;
using MediatR;

namespace BarbershopApi.Features.Appointments.GetAppointmentById;

public sealed class GetAppointmentByIdEndpoint : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapGet("/api/appointments/{id:guid}", async (Guid id, ISender sender, ClaimsPrincipal user) =>
        {
            var barbershopId = Guid.Parse(user.FindFirstValue("barbershop_id")!);
            var result = await sender.Send(new GetAppointmentByIdQuery(id, barbershopId));
            return result.IsSuccess ? Results.Ok(result.Value) : Results.NotFound(result.Error);
        })
        .RequireAuthorization()
        .WithTags("Appointments");
    }
}
