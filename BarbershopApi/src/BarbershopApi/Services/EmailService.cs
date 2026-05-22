using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace BarbershopApi.Services;

public interface IEmailService
{
    Task<bool> SendAsync(string to, string toName, string subject, string htmlBody);
}

public class EmailService(IHttpClientFactory httpFactory, IConfiguration config, ILogger<EmailService> logger) : IEmailService
{
    public async Task<bool> SendAsync(string to, string toName, string subject, string htmlBody)
    {
        var apiKey = config["SendGrid:ApiKey"];
        var fromEmail = config["SendGrid:FromEmail"] ?? "noreply@flatpurse.com";
        var fromName = config["SendGrid:FromName"] ?? "FlatPurse";

        if (string.IsNullOrEmpty(apiKey))
        {
            logger.LogWarning("SendGrid API key not configured — email to {To} skipped.", to);
            return false;
        }

        var payload = new
        {
            personalizations = new[] { new { to = new[] { new { email = to, name = toName } } } },
            from = new { email = fromEmail, name = fromName },
            subject,
            content = new[] { new { type = "text/html", value = htmlBody } }
        };

        var http = httpFactory.CreateClient();
        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

        var res = await http.PostAsync(
            "https://api.sendgrid.com/v3/mail/send",
            new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json"));

        if (!res.IsSuccessStatusCode)
        {
            var err = await res.Content.ReadAsStringAsync();
            logger.LogError("SendGrid error {Status}: {Error}", (int)res.StatusCode, err);
            return false;
        }

        return true;
    }
}
