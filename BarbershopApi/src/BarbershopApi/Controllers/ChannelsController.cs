using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
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
public class ChannelsController(AppDbContext db, ITenantService tenant, IHttpClientFactory httpFactory, IConfiguration config) : ControllerBase
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
    public async Task<IActionResult> VerifyEmailDomain([FromBody] VerifyEmailDomainRequest req)
    {
        var apiKey = config["SendGrid:ApiKey"];
        if (string.IsNullOrEmpty(apiKey))
            return StatusCode(502, new { error = "SendGrid not configured." });

        var http = httpFactory.CreateClient();
        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

        var payload = JsonSerializer.Serialize(new { domain = req.Domain, subdomain = "mail" });
        var res = await http.PostAsync("https://api.sendgrid.com/v3/whitelabel/domains",
            new StringContent(payload, Encoding.UTF8, "application/json"));

        if (!res.IsSuccessStatusCode)
            return StatusCode(502, new { error = "Failed to initiate domain verification with SendGrid." });

        var body = await res.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        return Ok(new
        {
            message = "Domain verification initiated. Add the DNS records to your domain registrar to complete setup.",
            records = doc.RootElement
        });
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

        string? accessToken = null;
        string? accountName = null;

        if (type is ChannelType.Instagram or ChannelType.Facebook or ChannelType.WhatsApp)
        {
            var clientId = config["Meta:AppId"];
            var clientSecret = config["Meta:AppSecret"];
            var redirectUri = req.RedirectUri ?? config["Meta:RedirectUri"];

            if (!string.IsNullOrEmpty(clientId) && !string.IsNullOrEmpty(clientSecret))
            {
                var http = httpFactory.CreateClient();
                var tokenUrl = $"https://graph.facebook.com/v19.0/oauth/access_token" +
                    $"?client_id={clientId}&client_secret={clientSecret}" +
                    $"&redirect_uri={Uri.EscapeDataString(redirectUri ?? "")}&code={req.Code}";

                var res = await http.GetAsync(tokenUrl);
                if (res.IsSuccessStatusCode)
                {
                    var json = await res.Content.ReadAsStringAsync();
                    using var doc = JsonDocument.Parse(json);
                    accessToken = doc.RootElement.TryGetProperty("access_token", out var t) ? t.GetString() : null;
                }
            }
        }
        else if (type == ChannelType.Google)
        {
            var clientId = config["Google:ClientId"];
            var clientSecret = config["Google:ClientSecret"];
            var redirectUri = req.RedirectUri ?? config["Google:RedirectUri"];

            if (!string.IsNullOrEmpty(clientId) && !string.IsNullOrEmpty(clientSecret))
            {
                var http = httpFactory.CreateClient();
                var form = new FormUrlEncodedContent([
                    new("code", req.Code),
                    new("client_id", clientId),
                    new("client_secret", clientSecret),
                    new("redirect_uri", redirectUri ?? ""),
                    new("grant_type", "authorization_code")
                ]);
                var res = await http.PostAsync("https://oauth2.googleapis.com/token", form);
                if (res.IsSuccessStatusCode)
                {
                    var json = await res.Content.ReadAsStringAsync();
                    using var doc = JsonDocument.Parse(json);
                    accessToken = doc.RootElement.TryGetProperty("access_token", out var t) ? t.GetString() : null;
                }
            }
        }

        var channel = await db.Channels.FirstOrDefaultAsync(c => c.BusinessId == bizId && c.Type == type);
        if (channel == null)
        {
            channel = new Channel { BusinessId = bizId, Type = type };
            db.Channels.Add(channel);
        }
        channel.Status = ChannelStatus.Connected;
        channel.AccessToken = accessToken ?? $"pending_{req.Code}";
        channel.ExternalAccountName = accountName;
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
