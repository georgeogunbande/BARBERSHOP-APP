using FlatPurse.Models;

namespace FlatPurse.Services;

public interface IPaymentService
{
    Task<IEnumerable<PaymentMethodDto>?> GetPaymentMethodsAsync(Guid clientId);
    Task<PaymentDto?> ChargeCardAsync(ChargeRequest req);
    Task<PaymentDto?> RecordCashAsync(RecordCashPaymentRequest req);
    Task<PaymentLinkResponse?> GeneratePaymentLinkAsync(GeneratePaymentLinkRequest req);
    Task<object?> GetPayoutsAsync(int page = 1, int limit = 20);
    Task<object?> GetPendingBalanceAsync();
}
