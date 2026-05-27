using FlatPurse.Models;

namespace FlatPurse.Services;

public class MessagingService : IMessagingService
{
    private readonly IApiService _api;

    public MessagingService(IApiService api) => _api = api;

    public Task<object?> SendSmsAsync(SendSmsRequest req) =>
        _api.PostAsync<object>("messaging/sms", req);

    public Task<object?> SendEmailAsync(SendEmailRequest req) =>
        _api.PostAsync<object>("messaging/email", req);

    public Task<object?> SendBlastAsync(BlastRequest req) =>
        _api.PostAsync<object>("messaging/blast", req);

    public Task<IEnumerable<MessageTemplateDto>?> GetTemplatesAsync() =>
        _api.GetAsync<IEnumerable<MessageTemplateDto>>("messaging/templates");
}
