using System.Security.Claims;
using Carter;
using MediatR;

namespace BarbershopApi.Features.Staff.GetStaff;

public sealed class GetStaffEndpoint : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapGet("/api/staff", async (ISender sender, ClaimsPrincipal user) =>
        {
            var barbershopId = Guid.Parse(user.FindFirstValue("barbershop_id")!);
            var result = await sender.Send(new GetStaffQuery(barbershopId));
            return result.IsSuccess ? Results.Ok(result.Value) : Results.BadRequest(result.Error);
        })
        .RequireAuthorization()
        .WithTags("Staff");
    }
}
