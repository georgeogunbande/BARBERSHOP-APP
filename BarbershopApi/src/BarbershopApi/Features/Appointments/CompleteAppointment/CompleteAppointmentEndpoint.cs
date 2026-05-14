using System.Security.Claims;
using Carter;
using MediatR;

namespace BarbershopApi.Features.Appointments.CompleteAppointment;

public sealed class CompleteAppointmentEndpoint : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/appointments/{id:guid}/complete", async (
            Guid id,
            CompleteAppointmentRequest request,
            ISender sender,
            ClaimsPrincipal user) =>
        {
            var barbershopId = Guid.Parse(user.FindFirstValue("barbershop_id")!);
            var command = new CompleteAppointmentCommand(id, barbershopId, request.TipAmount, request.PaymentMethod);
            var result = await sender.Send(command);
            return result.IsSuccess
                ? Results.Ok(result.Value)
                : result.IsNotFound ? Results.NotFound(result.Error) : Results.BadRequest(result.Error);
        })
        .RequireAuthorization()
        .WithTags("Appointments");
    }
}

public sealed record CompleteAppointmentRequest(
    decimal TipAmount,
    string PaymentMethod
);
