using BarbershopApi.Common;
using BarbershopApi.Features.Auth.Entities;
using BarbershopApi.Features.Auth.Register;
using BarbershopApi.Infrastructure.Auth;
using BarbershopApi.Infrastructure.Data;
using MediatR;
using Microsoft.AspNetCore.Identity;

namespace BarbershopApi.Features.Auth.Login;

public sealed class LoginHandler : IRequestHandler<LoginCommand, Result<AuthResponse>>
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly AuthDbContext _authDb;
    private readonly JwtService _jwtService;

    public LoginHandler(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        AuthDbContext authDb,
        JwtService jwtService)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _authDb = authDb;
        _jwtService = jwtService;
    }

    public async Task<Result<AuthResponse>> Handle(LoginCommand request, CancellationToken ct)
    {
        var user = await _userManager.FindByEmailAsync(request.Email);
        if (user is null)
            return Result<AuthResponse>.Fail("Invalid email or password.");

        var signInResult = await _signInManager.CheckPasswordSignInAsync(user, request.Password, lockoutOnFailure: false);
        if (!signInResult.Succeeded)
            return Result<AuthResponse>.Fail("Invalid email or password.");

        var accessToken = _jwtService.GenerateAccessToken(user);
        var refreshToken = _jwtService.GenerateRefreshToken(user.Id);

        _authDb.RefreshTokens.Add(refreshToken);
        await _authDb.SaveChangesAsync(ct);

        return Result<AuthResponse>.Ok(new AuthResponse(
            accessToken,
            refreshToken.Token,
            _jwtService.GetAccessTokenExpiry()
        ));
    }
}
