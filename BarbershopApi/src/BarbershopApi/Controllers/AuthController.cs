using BarbershopApi.Data;
using BarbershopApi.DTOs;
using BarbershopApi.Models.Auth;
using BarbershopApi.Models.Enums;
using BarbershopApi.Models.Business;
using BarbershopApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BarbershopApi.Controllers;

[ApiController]
[Route("auth")]
public class AuthController(
    UserManager<ApplicationUser> userManager,
    SignInManager<ApplicationUser> signInManager,
    AuthDbContext authDb,
    AppDbContext appDb,
    IJwtService jwt,
    ITenantService tenant,
    IConfiguration config) : ControllerBase
{
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest req)
    {
        if (await userManager.FindByEmailAsync(req.Email) != null)
            return Conflict(Error("EMAIL_EXISTS", "An account with this email already exists.", 409));

        var business = new Business { Name = req.BusinessName, City = req.City, Type = req.BusinessType };
        appDb.Businesses.Add(business);
        appDb.Subscriptions.Add(new Subscription { BusinessId = business.Id });
        await appDb.SaveChangesAsync();

        var user = new ApplicationUser
        {
            UserName = req.Email,
            Email = req.Email,
            FirstName = req.FirstName,
            LastName = req.LastName,
            BusinessId = business.Id,
            Role = StaffRole.Owner
        };

        var result = await userManager.CreateAsync(user, req.Password);
        if (!result.Succeeded)
            return BadRequest(Error("REGISTRATION_FAILED", result.Errors.First().Description, 400));

        var (accessToken, refreshToken) = await IssueTokensAsync(user);
        SetRefreshCookie(refreshToken.Token);

        return Ok(new AuthResponse(accessToken, MapUser(user, business)));
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        var user = await userManager.FindByEmailAsync(req.Email);
        if (user == null || !await userManager.CheckPasswordAsync(user, req.Password))
            return Unauthorized(Error("INVALID_CREDENTIALS", "Invalid email or password.", 401));

        if (!user.IsActive)
            return Unauthorized(Error("ACCOUNT_DISABLED", "Your account has been disabled.", 401));

        var (accessToken, _) = await IssueTokensAsync(user);
        var business = user.BusinessId.HasValue ? await appDb.Businesses.FindAsync(user.BusinessId) : null;

        return Ok(new AuthResponse(accessToken, MapUser(user, business)));
    }

    [HttpPost("login/magic-link")]
    public async Task<IActionResult> MagicLink([FromBody] MagicLinkRequest req)
    {
        var user = await userManager.FindByEmailAsync(req.Email);
        if (user == null) return Ok(new { message = "If that email exists, a magic link has been sent." });

        var token = await userManager.GenerateUserTokenAsync(user, "MagicLinkProvider", "magic-link-login");
        // TODO: send email with magic link containing token
        return Ok(new { message = "Magic link sent to your email." });
    }

    [HttpPost("login/google")]
    public IActionResult GoogleLogin() =>
        Ok(new { message = "Redirect to Google OAuth provider." });

    [HttpPost("login/apple")]
    public IActionResult AppleLogin() =>
        Ok(new { message = "Redirect to Apple Sign In provider." });

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        var refreshToken = Request.Cookies["refresh_token"];
        if (refreshToken != null)
        {
            var token = await authDb.RefreshTokens.FirstOrDefaultAsync(r => r.Token == refreshToken);
            if (token != null) { token.RevokedAt = DateTime.UtcNow; await authDb.SaveChangesAsync(); }
        }
        Response.Cookies.Delete("refresh_token");
        return NoContent();
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh()
    {
        var refreshTokenValue = Request.Cookies["refresh_token"];
        if (string.IsNullOrEmpty(refreshTokenValue))
            return Unauthorized(Error("MISSING_REFRESH_TOKEN", "No refresh token provided.", 401));

        var storedToken = await authDb.RefreshTokens
            .Include(r => r.User)
            .FirstOrDefaultAsync(r => r.Token == refreshTokenValue);

        if (storedToken == null || !storedToken.IsActive)
            return Unauthorized(Error("INVALID_REFRESH_TOKEN", "Refresh token is invalid or expired.", 401));

        storedToken.RevokedAt = DateTime.UtcNow;
        var (accessToken, newRefresh) = await IssueTokensAsync(storedToken.User);
        storedToken.ReplacedByToken = newRefresh.Token;
        await authDb.SaveChangesAsync();

        SetRefreshCookie(newRefresh.Token);
        return Ok(new { access_token = accessToken });
    }

    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest req)
    {
        var user = await userManager.FindByEmailAsync(req.Email);
        if (user != null)
        {
            var token = await userManager.GeneratePasswordResetTokenAsync(user);
            // TODO: send reset email
        }
        return Ok(new { message = "If that email exists, a reset link has been sent." });
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest req)
    {
        var user = await userManager.FindByEmailAsync(req.Email);
        if (user == null) return BadRequest(Error("INVALID_TOKEN", "Invalid or expired reset token.", 400));

        var result = await userManager.ResetPasswordAsync(user, req.Token, req.NewPassword);
        if (!result.Succeeded)
            return BadRequest(Error("RESET_FAILED", result.Errors.First().Description, 400));

        return Ok(new { message = "Password reset successfully." });
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me()
    {
        var userId = tenant.GetUserId();
        var user = await userManager.FindByIdAsync(userId!);
        if (user == null) return NotFound();

        var business = user.BusinessId.HasValue ? await appDb.Businesses.FindAsync(user.BusinessId) : null;
        return Ok(MapUser(user, business));
    }

    [HttpPatch("me")]
    [Authorize]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest req)
    {
        var user = await userManager.FindByIdAsync(tenant.GetUserId()!);
        if (user == null) return NotFound();

        if (req.FirstName != null) user.FirstName = req.FirstName;
        if (req.LastName != null) user.LastName = req.LastName;
        if (req.Phone != null) user.PhoneNumber = req.Phone;
        if (req.AvatarUrl != null) user.AvatarUrl = req.AvatarUrl;

        await userManager.UpdateAsync(user);
        var business = user.BusinessId.HasValue ? await appDb.Businesses.FindAsync(user.BusinessId) : null;
        return Ok(MapUser(user, business));
    }

    [HttpPost("invite")]
    [Authorize]
    public async Task<IActionResult> Invite([FromBody] InviteStaffRequest req)
    {
        if (!tenant.IsOwnerOrManager())
            return Forbid();

        var businessId = tenant.GetBusinessId()!.Value;
        var invite = new InviteToken
        {
            Email = req.Email,
            BusinessId = businessId,
            Role = req.Role,
            InvitedByUserId = tenant.GetUserId()!
        };

        authDb.InviteTokens.Add(invite);
        await authDb.SaveChangesAsync();
        // TODO: send invite email

        return Ok(new { message = $"Invitation sent to {req.Email}." });
    }

    [HttpPost("accept-invite/{token}")]
    public async Task<IActionResult> AcceptInvite(string token, [FromBody] AcceptInviteRequest req)
    {
        var invite = await authDb.InviteTokens.FirstOrDefaultAsync(i => i.Token == token);
        if (invite == null || invite.IsExpired || invite.IsAccepted)
            return BadRequest(Error("INVALID_INVITE", "This invite link is invalid or has expired.", 400));

        var user = new ApplicationUser
        {
            UserName = invite.Email,
            Email = invite.Email,
            FirstName = req.FirstName,
            LastName = req.LastName,
            BusinessId = invite.BusinessId,
            Role = invite.Role
        };

        var result = await userManager.CreateAsync(user, req.Password);
        if (!result.Succeeded)
            return BadRequest(Error("REGISTRATION_FAILED", result.Errors.First().Description, 400));

        invite.AcceptedAt = DateTime.UtcNow;
        await authDb.SaveChangesAsync();

        var (accessToken, refreshToken) = await IssueTokensAsync(user);
        SetRefreshCookie(refreshToken.Token);
        var business = await appDb.Businesses.FindAsync(invite.BusinessId);

        return Ok(new AuthResponse(accessToken, MapUser(user, business)));
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private async Task<(string AccessToken, RefreshToken RefreshToken)> IssueTokensAsync(ApplicationUser user)
    {
        var accessToken = jwt.GenerateAccessToken(user);
        var refreshTokenValue = jwt.GenerateRefreshToken();
        var expiryDays = int.Parse(config["Jwt:RefreshTokenExpiryDays"] ?? "30");

        var refreshToken = new RefreshToken
        {
            Token = refreshTokenValue,
            UserId = user.Id,
            ExpiresAt = DateTime.UtcNow.AddDays(expiryDays)
        };

        authDb.RefreshTokens.Add(refreshToken);
        await authDb.SaveChangesAsync();

        return (accessToken, refreshToken);
    }

    private void SetRefreshCookie(string token)
    {
        Response.Cookies.Append("refresh_token", token, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Strict,
            Expires = DateTime.UtcNow.AddDays(30)
        });
    }

    private static UserDto MapUser(ApplicationUser user, Business? business) => new(
        user.Id, user.FirstName, user.LastName, user.Email!, user.PhoneNumber, user.AvatarUrl, user.Role, user.BusinessId,
        business == null ? null : new BusinessSummaryDto(business.Id, business.Name, business.City, business.Type, business.LogoUrl, business.BookingHandle, SubscriptionPlan.Starter));

    private static object Error(string code, string message, int status) => new
    {
        error = new { code, message, status, request_id = Guid.NewGuid().ToString() }
    };
}
