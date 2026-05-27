using FlatPurse.Models;

namespace FlatPurse.Services;

public interface IMessagingService
{
    Task<object?> SendSmsAsync(SendSmsRequest req);
    Task<object?> SendEmailAsync(SendEmailRequest req);
    Task<object?> SendBlastAsync(BlastRequest req);
    Task<IEnumerable<MessageTemplateDto>?> GetTemplatesAsync();
}
