using FlatPurse.Models;

namespace FlatPurse.Services;

public class ClientService : IClientService
{
    private readonly IApiService _api;

    public ClientService(IApiService api) => _api = api;

    public Task<PagedResult<ClientDto>?> GetClientsAsync(int page = 1, int limit = 50, string? sort = null, ClientTag? tag = null, ChurnRisk? churnRisk = null)
    {
        var query = $"clients?page={page}&limit={limit}";
        if (sort != null) query += $"&sort={sort}";
        if (tag.HasValue) query += $"&filter[tag]={tag.Value}";
        if (churnRisk.HasValue) query += $"&filter[churn_risk]={churnRisk.Value}";
        return _api.GetAsync<PagedResult<ClientDto>>(query);
    }

    public Task<IEnumerable<ClientDto>?> SearchClientsAsync(string q, int limit = 20) =>
        _api.GetAsync<IEnumerable<ClientDto>>($"clients/search?q={Uri.EscapeDataString(q)}&limit={limit}");

    public Task<ClientDto?> GetClientAsync(Guid id) =>
        _api.GetAsync<ClientDto>($"clients/{id}");

    public Task<ClientDto?> CreateClientAsync(CreateClientRequest req) =>
        _api.PostAsync<ClientDto>("clients", req);

    public Task<ClientDto?> UpdateClientAsync(Guid id, UpdateClientRequest req) =>
        _api.PatchAsync<ClientDto>($"clients/{id}", req);

    public Task DeleteClientAsync(Guid id) => _api.DeleteAsync($"clients/{id}");

    public Task<IEnumerable<ClientNoteDto>?> GetNotesAsync(Guid clientId) =>
        _api.GetAsync<IEnumerable<ClientNoteDto>>($"clients/{clientId}/notes");

    public Task<ClientNoteDto?> AddNoteAsync(Guid clientId, AddNoteRequest req) =>
        _api.PostAsync<ClientNoteDto>($"clients/{clientId}/notes", req);

    public Task DeleteNoteAsync(Guid clientId, Guid noteId) =>
        _api.DeleteAsync($"clients/{clientId}/notes/{noteId}");

    public Task<ClientAiInsightDto?> GetAiInsightsAsync(Guid clientId) =>
        _api.GetAsync<ClientAiInsightDto>($"clients/{clientId}/ai");

    public Task TriggerWinbackAsync(Guid clientId) =>
        _api.PostAsync<object>($"clients/{clientId}/winback", new { });

    public Task SendMessageAsync(Guid clientId, SendMessageRequest req) =>
        _api.PostAsync<object>($"clients/{clientId}/messages", req);

    public Task<object?> GetMessagesAsync(Guid clientId) =>
        _api.GetAsync<object>($"clients/{clientId}/messages");

    public Task<object?> GetVisitsAsync(Guid clientId, int page = 1, int limit = 20) =>
        _api.GetAsync<object>($"clients/{clientId}/visits?page={page}&limit={limit}");

    public Task<object?> GetPaymentsAsync(Guid clientId, int page = 1, int limit = 20) =>
        _api.GetAsync<object>($"clients/{clientId}/payments?page={page}&limit={limit}");
}
