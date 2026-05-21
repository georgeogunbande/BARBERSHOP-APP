using FlatPurse.Models;

namespace FlatPurse.Services;

public class PaymentService
{
    private readonly ApiService _api;

    public PaymentService(ApiService api) => _api = api;

    public Task<IEnumerable<PaymentMethodDto>?> GetPaymentMethodsAsync(Guid clientId) =>
        _api.GetAsync<IEnumerable<PaymentMethodDto>>($"payments/methods?clientId={clientId}");

    public Task<PaymentDto?> ChargeCardAsync(ChargeRequest req) =>
        _api.PostAsync<PaymentDto>("payments/charge", req);

    public Task<PaymentDto?> RecordCashAsync(RecordCashPaymentRequest req) =>
        _api.PostAsync<PaymentDto>("payments/cash", req);

    public Task<PaymentLinkResponse?> GeneratePaymentLinkAsync(GeneratePaymentLinkRequest req) =>
        _api.PostAsync<PaymentLinkResponse>("payments/payment-link", req);

    public Task<object?> GetPayoutsAsync(int page = 1, int limit = 20) =>
        _api.GetAsync<object>($"payouts?page={page}&limit={limit}");

    public Task<object?> GetPendingBalanceAsync() =>
        _api.GetAsync<object>("payouts/pending");
}
