using System.Security.Claims;
using Carter;
using MediatR;

namespace BarbershopApi.Features.Staff.CreateStaffMember;

public sealed class CreateStaffMemberEndpoint : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/staff", async (CreateStaffMemberRequest request, ISender sender, ClaimsPrincipal user) =>
        {
            var barbershopId = Guid.Parse(user.FindFirstValue("barbershop_id")!);
            var command = new CreateStaffMemberCommand(
                barbershopId,
                request.Name,
                request.Role,
                request.Email,
                request.Phone,
                request.Bio,
                request.WorkingHoursJson);

            var result = await sender.Send(command);
            return result.IsSuccess
                ? Results.Created($"/api/staff/{result.Value!.Id}", result.Value)
                : Results.BadRequest(result.Error);
        })
        .RequireAuthorization()
        .WithTags("Staff");
    }
}

public sealed record CreateStaffMemberRequest(
    string Name,
    string Role,
    string Email,
    string Phone,
    string Bio,
    string WorkingHoursJson
);
