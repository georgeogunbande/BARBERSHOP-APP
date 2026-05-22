using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace BarbershopApi.Services;

public interface ISmsService
{
    Task<(string? Sid, string? Status, string? Error)> SendAsync(string to, string body);
}

public class SmsService(IHttpClientFactory httpFactory, IConfiguration config, ILogger<SmsService> logger) : ISmsService
{
    public async Task<(string? Sid, string? Status, string? Error)> SendAsync(string to, string body)
    {
        var sid = config["Twilio:AccountSid"];
        var token = config["Twilio:AuthToken"];
        var from = config["Twilio:PhoneNumber"];

        if (string.IsNullOrEmpty(sid) || string.IsNullOrEmpty(token) || string.IsNullOrEmpty(from))
            return (null, null, "Twilio credentials not configured");

        var http = httpFactory.CreateClient();
        var credentials = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{sid}:{token}"));
        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", credentials);

        var form = new FormUrlEncodedContent([
            new("To", to), new("From", from), new("Body", body)
        ]);

        var res = await http.PostAsync(
            $"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json", form);

        var json = await res.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        if (!res.IsSuccessStatusCode)
        {
            var errMsg = root.TryGetProperty("message", out var msg) ? msg.GetString() : "Twilio error";
            logger.LogError("Twilio error sending to {To}: {Error}", to, errMsg);
            return (null, null, errMsg);
        }

        return (
            root.TryGetProperty("sid", out var sidProp) ? sidProp.GetString() : null,
            root.TryGetProperty("status", out var statusProp) ? statusProp.GetString() : null,
            null
        );
    }
}
