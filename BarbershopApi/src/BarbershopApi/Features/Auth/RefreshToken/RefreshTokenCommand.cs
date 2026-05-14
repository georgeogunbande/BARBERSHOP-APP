using BarbershopApi.Common;
using BarbershopApi.Features.Auth.Register;
using MediatR;

namespace BarbershopApi.Features.Auth.RefreshToken;

public sealed record RefreshTokenCommand(
    string Token
) : IRequest<Result<AuthResponse>>;
