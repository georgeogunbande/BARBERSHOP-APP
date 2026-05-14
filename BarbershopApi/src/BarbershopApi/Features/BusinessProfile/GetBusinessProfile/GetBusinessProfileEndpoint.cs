using System.Security.Claims;
using Carter;
using MediatR;

namespace BarbershopApi.Features.BusinessProfile.GetBusinessProfile;

public sealed class GetBusinessProfileEndpoint : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapGet("/api/business-profile", async (ISender sender, ClaimsPrincipal user) =>
        {
            var barbershopId = Guid.Parse(user.FindFirstValue("barbershop_id")!);
            var result = await sender.Send(new GetBusinessProfileQuery(barbershopId));
            return result.IsSuccess ? Results.Ok(result.Value) : Results.NotFound(result.Error);
        })
        .RequireAuthorization()
        .WithTags("BusinessProfile");
    }
}
