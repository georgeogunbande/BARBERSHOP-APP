using FlatPurse.Models;

namespace FlatPurse.Services;

public interface IBookingService
{
    Task<object?> GetBookingsAsync(DateTime? from = null, DateTime? to = null, Guid? staffId = null, int page = 1, int limit = 50);
    Task<BookingDto?> GetBookingAsync(Guid id);
    Task<BookingDto?> CreateBookingAsync(CreateBookingRequest req);
    Task<BookingDto?> UpdateBookingAsync(Guid id, UpdateBookingRequest req);
    Task CancelBookingAsync(Guid id);
    Task<BookingDto?> CompleteBookingAsync(Guid id);
    Task<object?> NoShowBookingAsync(Guid id);
    Task<IEnumerable<object>?> GetAvailableSlotsAsync(Guid serviceId, Guid? staffMemberId, DateTime date);
    Task<IEnumerable<ServiceDto>?> GetServicesAsync();
    Task<IEnumerable<StaffDto>?> GetStaffAsync();
}
