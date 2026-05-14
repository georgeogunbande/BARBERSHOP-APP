using BarbershopApi.Data;
using BarbershopApi.DTOs;
using BarbershopApi.Models.Channels;
using BarbershopApi.Models.Enums;
using BarbershopApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BarbershopApi.Controllers;

[ApiController]
[Route("channels")]
[Authorize]
public class ChannelsController(AppDbContext db, ITenantService tenant) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List()
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var channels = await db.Channels.Where(c => c.BusinessId == bizId).ToListAsync();
        var allTypes = Enum.GetValues<ChannelType>();
        var result = allTypes.Select(t =>
        {
            var ch = channels.FirstOrDefault(c => c.Type == t);
            return ch != null
                ? new ChannelDto(ch.Id, ch.Type, ch.Status, ch.ExternalAccountName, ch.ConnectedAt)
                : new ChannelDto(Guid.Empty, t, ChannelStatus.Disconnected, null, null);
        });
        return Ok(result);
    }

    [HttpPost("instagram/connect")]
    public async Task<IActionResult> ConnectInstagram([FromBody] ConnectChannelRequest req) =>
        await ConnectChannelAsync(ChannelType.Instagram, req);

    [HttpDelete("instagram")]
    public async Task<IActionResult> DisconnectInstagram() =>
        await DisconnectChannelAsync(ChannelType.Instagram);

    [HttpPost("facebook/connect")]
    public async Task<IActionResult> ConnectFacebook([FromBody] ConnectChannelRequest req) =>
        await ConnectChannelAsync(ChannelType.Facebook, req);

    [HttpDelete("facebook")]
    public async Task<IActionResult> DisconnectFacebook() =>
        await DisconnectChannelAsync(ChannelType.Facebook);

    [HttpPost("whatsapp/connect")]
    public async Task<IActionResult> ConnectWhatsApp([FromBody] ConnectChannelRequest req) =>
        await ConnectChannelAsync(ChannelType.WhatsApp, req);

    [HttpDelete("whatsapp")]
    public async Task<IActionResult> DisconnectWhatsApp() =>
        await DisconnectChannelAsync(ChannelType.WhatsApp);

    [HttpPost("google/connect")]
    public async Task<IActionResult> ConnectGoogle([FromBody] ConnectChannelRequest req) =>
        await ConnectChannelAsync(ChannelType.Google, req);

    [HttpDelete("google")]
    public async Task<IActionResult> DisconnectGoogle() =>
        await DisconnectChannelAsync(ChannelType.Google);

    [HttpPost("email/verify")]
    public async Task<IActionResult> VerifyEmailDomain([FromBody] object req)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        // TODO: trigger SendGrid domain verification
        await Task.CompletedTask;
        return Ok(new { message = "DNS verification records sent to your email. Add them to your domain to complete verification." });
    }

    [HttpGet("sms/number")]
    public async Task<IActionResult> GetSmsNumber()
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var channel = await db.Channels.FirstOrDefaultAsync(c => c.BusinessId == bizId && c.Type == ChannelType.SMS);
        return Ok(new { phoneNumber = channel?.ExternalAccountId ?? null, status = channel?.Status ?? ChannelStatus.Disconnected });
    }

    [HttpGet("webhooks")]
    public async Task<IActionResult> GetWebhooks()
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var channels = await db.Channels.Where(c => c.BusinessId == bizId && c.WebhookUrl != null).ToListAsync();
        return Ok(channels.Select(c => new { c.Type, c.WebhookUrl, c.Status }));
    }

    private async Task<IActionResult> ConnectChannelAsync(ChannelType type, ConnectChannelRequest req)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        // TODO: exchange OAuth code for access token via provider API
        var channel = await db.Channels.FirstOrDefaultAsync(c => c.BusinessId == bizId && c.Type == type);
        if (channel == null)
        {
            channel = new Channel { BusinessId = bizId, Type = type };
            db.Channels.Add(channel);
        }
        channel.Status = ChannelStatus.Connected;
        channel.AccessToken = $"access_token_placeholder_{req.Code}";
        channel.ConnectedAt = DateTime.UtcNow;
        channel.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(new ChannelDto(channel.Id, channel.Type, channel.Status, channel.ExternalAccountName, channel.ConnectedAt));
    }

    private async Task<IActionResult> DisconnectChannelAsync(ChannelType type)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var channel = await db.Channels.FirstOrDefaultAsync(c => c.BusinessId == bizId && c.Type == type);
        if (channel == null) return NotFound();
        channel.Status = ChannelStatus.Disconnected;
        channel.AccessToken = null;
        channel.RefreshToken = null;
        channel.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return NoContent();
    }
}
