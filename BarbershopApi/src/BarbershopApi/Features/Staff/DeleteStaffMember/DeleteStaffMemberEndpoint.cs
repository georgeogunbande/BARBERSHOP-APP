using System.Security.Claims;
using Carter;
using MediatR;

namespace BarbershopApi.Features.Staff.DeleteStaffMember;

public sealed class DeleteStaffMemberEndpoint : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapDelete("/api/staff/{id:guid}", async (Guid id, ISender sender, ClaimsPrincipal user) =>
        {
            var barbershopId = Guid.Parse(user.FindFirstValue("barbershop_id")!);
            var result = await sender.Send(new DeleteStaffMemberCommand(id, barbershopId));
            return result.IsSuccess ? Results.NoContent() : Results.NotFound(result.Error);
        })
        .RequireAuthorization()
        .WithTags("Staff");
    }
}
