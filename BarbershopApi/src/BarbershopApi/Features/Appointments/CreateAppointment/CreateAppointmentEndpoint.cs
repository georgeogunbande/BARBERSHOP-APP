using System.Security.Claims;
using Carter;
using MediatR;

namespace BarbershopApi.Features.Appointments.CreateAppointment;

public sealed class CreateAppointmentEndpoint : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/appointments", async (
            CreateAppointmentRequest request,
            ISender sender,
            ClaimsPrincipal user) =>
        {
            var barbershopId = Guid.Parse(user.FindFirstValue("barbershop_id")!);
            var command = new CreateAppointmentCommand(
                barbershopId,
                request.ClientId,
                request.StaffMemberId,
                request.ServiceId,
                request.ScheduledAt,
                request.DurationMinutes,
                request.Price,
                request.Notes);

            var result = await sender.Send(command);
            return result.IsSuccess
                ? Results.Created($"/api/appointments/{result.Value!.Id}", result.Value)
                : Results.BadRequest(result.Error);
        })
        .RequireAuthorization()
        .WithTags("Appointments");
    }
}

public sealed record CreateAppointmentRequest(
    Guid ClientId,
    Guid StaffMemberId,
    Guid ServiceId,
    DateTime ScheduledAt,
    int DurationMinutes,
    decimal Price,
    string Notes
);
