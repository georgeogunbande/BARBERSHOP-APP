using FlatPurse.Models;

namespace FlatPurse.Services;

public interface IClientService
{
    Task<PagedResult<ClientDto>?> GetClientsAsync(int page = 1, int limit = 50, string? sort = null, ClientTag? tag = null, ChurnRisk? churnRisk = null);
    Task<IEnumerable<ClientDto>?> SearchClientsAsync(string q, int limit = 20);
    Task<ClientDto?> GetClientAsync(Guid id);
    Task<ClientDto?> CreateClientAsync(CreateClientRequest req);
    Task<ClientDto?> UpdateClientAsync(Guid id, UpdateClientRequest req);
    Task DeleteClientAsync(Guid id);
    Task<IEnumerable<ClientNoteDto>?> GetNotesAsync(Guid clientId);
    Task<ClientNoteDto?> AddNoteAsync(Guid clientId, AddNoteRequest req);
    Task DeleteNoteAsync(Guid clientId, Guid noteId);
    Task<ClientAiInsightDto?> GetAiInsightsAsync(Guid clientId);
    Task TriggerWinbackAsync(Guid clientId);
    Task SendMessageAsync(Guid clientId, SendMessageRequest req);
    Task<object?> GetMessagesAsync(Guid clientId);
    Task<object?> GetVisitsAsync(Guid clientId, int page = 1, int limit = 20);
    Task<object?> GetPaymentsAsync(Guid clientId, int page = 1, int limit = 20);
}
