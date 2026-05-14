using System.Security.Claims;
using Carter;
using MediatR;

namespace BarbershopApi.Features.Staff.UpdateStaffMember;

public sealed class UpdateStaffMemberEndpoint : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapPut("/api/staff/{id:guid}", async (
            Guid id,
            UpdateStaffMemberRequest request,
            ISender sender,
            ClaimsPrincipal user) =>
        {
            var barbershopId = Guid.Parse(user.FindFirstValue("barbershop_id")!);
            var command = new UpdateStaffMemberCommand(
                id,
                barbershopId,
                request.Name,
                request.Role,
                request.Email,
                request.Phone,
                request.Bio,
                request.IsActive,
                request.WorkingHoursJson);

            var result = await sender.Send(command);
            return result.IsSuccess
                ? Results.Ok(result.Value)
                : result.IsNotFound ? Results.NotFound(result.Error) : Results.BadRequest(result.Error);
        })
        .RequireAuthorization()
        .WithTags("Staff");
    }
}

public sealed record UpdateStaffMemberRequest(
    string Name,
    string Role,
    string Email,
    string Phone,
    string Bio,
    bool IsActive,
    string WorkingHoursJson
);
