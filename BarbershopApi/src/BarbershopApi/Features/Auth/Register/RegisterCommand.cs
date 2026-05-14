using BarbershopApi.Common;
using MediatR;

namespace BarbershopApi.Features.Auth.Register;

public sealed record RegisterCommand(
    string FirstName,
    string LastName,
    string Email,
    string Password,
    string BusinessName
) : IRequest<Result<AuthResponse>>;

public sealed record AuthResponse(
    string AccessToken,
    string RefreshToken,
    DateTime ExpiresAt
);
