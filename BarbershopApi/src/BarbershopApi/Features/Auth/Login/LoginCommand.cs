using BarbershopApi.Common;
using BarbershopApi.Features.Auth.Register;
using MediatR;

namespace BarbershopApi.Features.Auth.Login;

public sealed record LoginCommand(
    string Email,
    string Password
) : IRequest<Result<AuthResponse>>;
