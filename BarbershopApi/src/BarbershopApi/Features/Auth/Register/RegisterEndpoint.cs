using Carter;
using MediatR;

namespace BarbershopApi.Features.Auth.Register;

public sealed class RegisterEndpoint : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/auth/register", async (RegisterCommand command, ISender sender) =>
        {
            var result = await sender.Send(command);
            return result.IsSuccess
                ? Results.Ok(result.Value)
                : Results.BadRequest(result.Error);
        })
        .AllowAnonymous()
        .WithTags("Auth");
    }
}
