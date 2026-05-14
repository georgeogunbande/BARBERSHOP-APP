using BarbershopApi.Common;
using BarbershopApi.Features.Auth.Entities;
using BarbershopApi.Features.Auth.Register;
using BarbershopApi.Infrastructure.Auth;
using BarbershopApi.Infrastructure.Data;
using MediatR;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace BarbershopApi.Features.Auth.RefreshToken;

public sealed class RefreshTokenHandler : IRequestHandler<RefreshTokenCommand, Result<AuthResponse>>
{
    private readonly AuthDbContext _authDb;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly JwtService _jwtService;

    public RefreshTokenHandler(
        AuthDbContext authDb,
        UserManager<ApplicationUser> userManager,
        JwtService jwtService)
    {
        _authDb = authDb;
        _userManager = userManager;
        _jwtService = jwtService;
    }

    public async Task<Result<AuthResponse>> Handle(RefreshTokenCommand request, CancellationToken ct)
    {
        var existingToken = await _authDb.RefreshTokens
            .FirstOrDefaultAsync(t => t.Token == request.Token, ct);

        if (existingToken is null)
            return Result<AuthResponse>.Fail("Invalid refresh token.");

        if (!existingToken.IsActive)
            return Result<AuthResponse>.Fail("Refresh token is expired or revoked.");

        var user = await _userManager.FindByIdAsync(existingToken.UserId);
        if (user is null)
            return Result<AuthResponse>.Fail("User not found.");

        existingToken.RevokedAt = DateTime.UtcNow;

        var newRefreshToken = _jwtService.GenerateRefreshToken(user.Id);
        _authDb.RefreshTokens.Add(newRefreshToken);

        await _authDb.SaveChangesAsync(ct);

        var accessToken = _jwtService.GenerateAccessToken(user);

        return Result<AuthResponse>.Ok(new AuthResponse(
            accessToken,
            newRefreshToken.Token,
            _jwtService.GetAccessTokenExpiry()
        ));
    }
}
