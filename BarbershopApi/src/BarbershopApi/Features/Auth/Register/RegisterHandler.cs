using BarbershopApi.Common;
using BarbershopApi.Features.Auth.Entities;
using BarbershopApi.Infrastructure.Auth;
using BarbershopApi.Infrastructure.Data;
using MediatR;
using Microsoft.AspNetCore.Identity;

namespace BarbershopApi.Features.Auth.Register;

public sealed class RegisterHandler : IRequestHandler<RegisterCommand, Result<AuthResponse>>
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly AuthDbContext _authDb;
    private readonly AppDbContext _appDb;
    private readonly JwtService _jwtService;

    public RegisterHandler(
        UserManager<ApplicationUser> userManager,
        AuthDbContext authDb,
        AppDbContext appDb,
        JwtService jwtService)
    {
        _userManager = userManager;
        _authDb = authDb;
        _appDb = appDb;
        _jwtService = jwtService;
    }

    public async Task<Result<AuthResponse>> Handle(RegisterCommand request, CancellationToken ct)
    {
        var existingUser = await _userManager.FindByEmailAsync(request.Email);
        if (existingUser is not null)
            return Result<AuthResponse>.Fail("A user with this email already exists.");

        var barberShopId = Guid.NewGuid();

        var user = new ApplicationUser
        {
            UserName = request.Email,
            Email = request.Email,
            FirstName = request.FirstName,
            LastName = request.LastName,
            BarberShopId = barberShopId,
            CreatedAt = DateTime.UtcNow
        };

        var createResult = await _userManager.CreateAsync(user, request.Password);
        if (!createResult.Succeeded)
        {
            var errors = string.Join("; ", createResult.Errors.Select(e => e.Description));
            return Result<AuthResponse>.Fail(errors);
        }

        var businessProfile = new Features.BusinessProfile.Entities.BusinessProfile
        {
            Id = Guid.NewGuid(),
            BarberShopId = barberShopId,
            Name = request.BusinessName,
            UpdatedAt = DateTime.UtcNow
        };

        _appDb.BusinessProfiles.Add(businessProfile);
        await _appDb.SaveChangesAsync(ct);

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
