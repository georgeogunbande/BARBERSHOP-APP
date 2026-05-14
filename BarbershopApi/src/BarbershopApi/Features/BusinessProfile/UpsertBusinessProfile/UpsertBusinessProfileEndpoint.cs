using System.Security.Claims;
using Carter;
using MediatR;

namespace BarbershopApi.Features.BusinessProfile.UpsertBusinessProfile;

public sealed class UpsertBusinessProfileEndpoint : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapPut("/api/business-profile", async (
            UpsertBusinessProfileRequest request,
            ISender sender,
            ClaimsPrincipal user) =>
        {
            var barbershopId = Guid.Parse(user.FindFirstValue("barbershop_id")!);
            var command = new UpsertBusinessProfileCommand(
                barbershopId,
                request.Name,
                request.Address,
                request.Phone,
                request.Email,
                request.Website,
                request.BookingLinkSlug,
                request.LogoUrl,
                request.WorkingHoursJson);

            var result = await sender.Send(command);
            return result.IsSuccess ? Results.Ok(result.Value) : Results.BadRequest(result.Error);
        })
        .RequireAuthorization()
        .WithTags("BusinessProfile");
    }
}

public sealed record UpsertBusinessProfileRequest(
    string Name,
    string Address,
    string Phone,
    string Email,
    string Website,
    string BookingLinkSlug,
    string LogoUrl,
    string WorkingHoursJson
);
