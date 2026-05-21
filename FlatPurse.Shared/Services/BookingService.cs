using FlatPurse.Models;

namespace FlatPurse.Services;

public class BookingService
{
    private readonly ApiService _api;

    public BookingService(ApiService api) => _api = api;

    public Task<object?> GetBookingsAsync(DateTime? from = null, DateTime? to = null, Guid? staffId = null, int page = 1, int limit = 50)
    {
        var query = $"bookings?page={page}&limit={limit}";
        if (from.HasValue) query += $"&from={from.Value:O}";
        if (to.HasValue) query += $"&to={to.Value:O}";
        if (staffId.HasValue) query += $"&staffId={staffId.Value}";
        return _api.GetAsync<object>(query);
    }

    public Task<BookingDto?> GetBookingAsync(Guid id) =>
        _api.GetAsync<BookingDto>($"bookings/{id}");

    public Task<BookingDto?> CreateBookingAsync(CreateBookingRequest req) =>
        _api.PostAsync<BookingDto>("bookings", req);

    public Task<BookingDto?> UpdateBookingAsync(Guid id, UpdateBookingRequest req) =>
        _api.PatchAsync<BookingDto>($"bookings/{id}", req);

    public Task CancelBookingAsync(Guid id) => _api.DeleteAsync($"bookings/{id}");

    public Task<BookingDto?> CompleteBookingAsync(Guid id) =>
        _api.PostAsync<BookingDto>($"bookings/{id}/complete", new { });

    public Task<object?> NoShowBookingAsync(Guid id) =>
        _api.PostAsync<object>($"bookings/{id}/no-show", new { });

    public Task<IEnumerable<object>?> GetAvailableSlotsAsync(Guid serviceId, Guid? staffMemberId, DateTime date)
    {
        var query = $"bookings/slots?serviceId={serviceId}&date={date:O}";
        if (staffMemberId.HasValue) query += $"&staffMemberId={staffMemberId.Value}";
        return _api.GetAsync<IEnumerable<object>>(query);
    }

    public Task<IEnumerable<ServiceDto>?> GetServicesAsync() =>
        _api.GetAsync<IEnumerable<ServiceDto>>("services");

    public Task<IEnumerable<StaffDto>?> GetStaffAsync() =>
        _api.GetAsync<IEnumerable<StaffDto>>("staff");
}
