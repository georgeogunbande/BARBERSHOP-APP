# Barbershop App — Models & API Service Implementation

> **Target:** .NET 9 · C# 13  
> All services communicate with a REST API via `ApiService`.  
> Copy each section into your own solution, adjusting the namespace as needed.

---

## Table of Contents

1. [Models (`AppModels.cs`)](#1-models)
2. [ITokenStorage interface](#2-itokenstorage)
3. [ApiService](#3-apiservice)
4. [AppStateService](#4-appstateservice)
5. [AuthService](#5-authservice)
6. [ClientService](#6-clientservice)
7. [BookingService](#7-bookingservice)
8. [PaymentService](#8-paymentservice)
9. [AutoPilotService](#9-autopilotservice)
10. [MessagingService](#10-messagingservice)
11. [DashboardService](#11-dashboardservice)
12. [DI Registration](#12-di-registration)
13. [API Endpoint Summary](#13-api-endpoint-summary)

---

## 1. Models

**File:** `Models/AppModels.cs`  
**Namespace:** `YourApp.Models`

```csharp
namespace YourApp.Models;

// ?? Enums ?????????????????????????????????????????????????????????????????????

public enum StaffRole { Owner, Manager, Stylist, Receptionist }

public enum BookingStatus { Pending, Confirmed, InProgress, Completed, Cancelled, NoShow }

public enum PaymentStatus { Pending, Succeeded, Failed, Refunded, PartialRefund }

public enum PaymentMethod { Card, Cash, TapToPay, PaymentLink, Interac }

public enum ClientTag { VIP, NewClient, Inactive, HighSpender, FrequentCanceller }

public enum ChurnRisk { Low, Medium, High }

public enum AutoPilotFlowId
{
    RebookReminder,
    SlotFiller,
    Winback,
    NoShowRecovery,
    BirthdayOffer,
    UpsellPrompt,
    ReviewRequest,
    FamilyHours,
    CancellationAlert,
    ChurnAlert
}

public enum SubscriptionPlan { Starter, Growth, Scale }

public enum ChannelType { Instagram, Facebook, WhatsApp, Google, Email, SMS }

public enum ChannelStatus { Connected, Disconnected, Error }

public enum NotificationType
{
    BookingConfirmed,
    BookingCancelled,
    BookingReminder,
    PaymentReceived,
    NewClient,
    AutoPilotAction,
    ChurnAlert,
    DailyBrief,
    ReviewReceived
}

public enum MessageChannel { SMS, Email, Push, WhatsApp, Instagram, Facebook }

public enum AiConversationStatus { Active, HandedOff, Resolved }

// ?? Auth ?????????????????????????????????????????????????????????????????????

public record RegisterRequest(
    string FirstName,
    string LastName,
    string Email,
    string Password,
    string BusinessName,
    string? City,
    string? BusinessType);

public record LoginRequest(string Email, string Password);

public record AuthResponse(string AccessToken, UserDto User);

public record UserDto(
    string Id,
    string FirstName,
    string LastName,
    string Email,
    string? Phone,
    string? AvatarUrl,
    StaffRole Role,
    Guid? BusinessId,
    BusinessSummaryDto? Business);

public record BusinessSummaryDto(
    Guid Id,
    string Name,
    string? City,
    string? Type,
    string? LogoUrl,
    string? BookingHandle,
    SubscriptionPlan Plan);

// ?? Business ?????????????????????????????????????????????????????????????????

public record BusinessDto(
    Guid Id,
    string Name,
    string? City,
    string? Type,
    string? LogoUrl,
    string? CoverPhotoUrl,
    string? BookingHandle,
    string? ActiveTheme,
    string? Currency,
    DateTime CreatedAt);

// ?? Clients ???????????????????????????????????????????????????????????????????

public record CreateClientRequest(
    string FirstName,
    string LastName,
    string? Email,
    string? Phone,
    DateTime? DateOfBirth);

public record UpdateClientRequest(
    string? FirstName,
    string? LastName,
    string? Email,
    string? Phone,
    DateTime? DateOfBirth,
    List<ClientTag>? Tags,
    int? RebookIntervalDays);

public record AddNoteRequest(string Content, bool IsPinned = false);

public record SendMessageRequest(string Body, MessageChannel Channel, string? Subject = null);

public record ClientDto(
    Guid Id,
    string FirstName,
    string LastName,
    string? Email,
    string? Phone,
    string? AvatarUrl,
    List<ClientTag> Tags,
    ChurnRisk ChurnRisk,
    decimal LifetimeValue,
    int VisitCount,
    DateTime? LastVisitAt,
    DateTime CreatedAt);

public record ClientNoteDto(
    Guid Id,
    string Content,
    bool IsPinned,
    string AuthorUserId,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public record ClientAiInsightDto(
    ChurnRisk ChurnRisk,
    decimal PredictedLtv,
    List<string> UpsellOpportunities,
    string? WinbackMessage,
    DateTime UpdatedAt);

public record PagedResult<T>(List<T> Items, int Total, int Page, int Limit);

// ?? Bookings ??????????????????????????????????????????????????????????????????

public record CreateBookingRequest(
    Guid ClientId,
    Guid ServiceId,
    Guid StaffMemberId,
    DateTime StartsAt,
    string? Notes);

public record UpdateBookingRequest(
    DateTime? StartsAt,
    Guid? StaffMemberId,
    string? Notes);

public record BookingDto(
    Guid Id,
    Guid ClientId,
    string ClientName,
    Guid ServiceId,
    string ServiceName,
    Guid StaffMemberId,
    string StaffName,
    DateTime StartsAt,
    DateTime EndsAt,
    BookingStatus Status,
    decimal Price,
    string? Notes,
    DateTime CreatedAt);

public record TimeSlotDto(DateTime StartsAt, DateTime EndsAt, Guid StaffId, string StaffName);

// ?? Services ??????????????????????????????????????????????????????????????????

public record ServiceDto(
    Guid Id,
    string Name,
    decimal Price,
    int DurationMins,
    string? Category,
    bool Active,
    decimal DepositPct,
    int BookingCount,
    DateTime CreatedAt);

// ?? Staff ?????????????????????????????????????????????????????????????????????

public record StaffDto(
    Guid Id,
    string FirstName,
    string LastName,
    string? Email,
    string? Phone,
    string? AvatarUrl,
    string? Colour,
    StaffRole Role,
    bool IsActive,
    List<Guid> ServiceIds);

// ?? Payments ??????????????????????????????????????????????????????????????????

public record ChargeRequest(
    Guid BookingId,
    Guid ClientId,
    string StripePaymentMethodId,
    decimal Amount,
    decimal TipAmount = 0);

public record RecordCashPaymentRequest(Guid BookingId, decimal Amount, decimal TipAmount = 0);

public record GeneratePaymentLinkRequest(Guid BookingId, decimal Amount, string? Note);

public record PaymentMethodDto(
    Guid Id,
    string Brand,
    string Last4,
    int ExpMonth,
    int ExpYear,
    bool IsDefault);

public record PaymentDto(
    Guid Id,
    Guid BookingId,
    decimal Amount,
    decimal TipAmount,
    decimal PlatformFee,
    decimal NetAmount,
    PaymentStatus Status,
    PaymentMethod Method,
    DateTime CreatedAt);

public record PaymentLinkResponse(string Token, string Url);

// ?? AutoPilot ?????????????????????????????????????????????????????????????????

public record UpdateFlowRequest(bool IsEnabled, string? CustomSettings);

public record AutoPilotStatusDto(bool GloballyEnabled, List<FlowStatusDto> Flows);

public record FlowStatusDto(
    AutoPilotFlowId FlowId,
    string Name,
    string Description,
    bool IsEnabled,
    string Trigger,
    string Action);

public record AutoPilotEventDto(
    Guid Id,
    AutoPilotFlowId FlowId,
    string FlowName,
    Guid? ClientId,
    string? ClientName,
    string? Description,
    bool WasSuccessful,
    decimal? RevenueRecovered,
    DateTime CreatedAt);

public record AutoPilotStatsDto(
    int SlotsFilled,
    int MessagesSent,
    int WinbacksTriggered,
    int ReviewsRequested,
    int NoShowsRecovered,
    decimal TotalRevenueRecovered);

// ?? Messaging ?????????????????????????????????????????????????????????????????

public record SendSmsRequest(Guid ClientId, string Message);

public record SendEmailRequest(Guid ClientId, string Subject, string Body);

public record BlastRequest(string Message, List<ClientTag>? Tags, ChurnRisk? ChurnRisk);

public record MessageTemplateDto(
    Guid Id,
    string Name,
    string Subject,
    string Body,
    MessageChannel Channel,
    bool IsActive,
    DateTime CreatedAt);

public record ChannelDto(
    Guid Id,
    ChannelType Type,
    ChannelStatus Status,
    string? Handle,
    string? ExternalAccountName,
    DateTime? ConnectedAt);

// ?? Dashboard ?????????????????????????????????????????????????????????????????

public record DailyBriefDto(
    DateTime Date,
    int AppointmentsToday,
    decimal RevenueTodayProjected,
    List<BookingDto> UpcomingBookings,
    List<string> AutoPilotHighlights,
    List<string> Alerts);

// ?? Settings ?????????????????????????????????????????????????????????????????

public record BusinessSettingsDto(
    BusinessDto Business,
    BookingSettingsDto Booking,
    DepositSettingsDto Deposit,
    NotificationSettingsDto Notifications);

public record BookingSettingsDto(
    int MinAdvanceNoticeHours,
    int MaxAdvanceDays,
    bool AllowPublicBooking,
    bool RequireDeposit);

public record DepositSettingsDto(decimal DefaultDepositPct);

public record NotificationSettingsDto(
    bool BookingConfirmations,
    bool BookingReminders,
    bool PaymentReceipts,
    bool AutoPilotAlerts);

public record SubscriptionDto(
    SubscriptionPlan Plan,
    bool IsTrialing,
    DateTime? TrialEndsAt,
    DateTime? CurrentPeriodEnd,
    bool IsActive);
```

---

## 2. ITokenStorage

**File:** `Services/ITokenStorage.cs`  
**Namespace:** `YourApp.Services`


```csharp
namespace YourApp.Services;

public interface ITokenStorage
{
    Task<string?> GetTokenAsync();
    Task SetTokenAsync(string token);
    Task ClearTokenAsync();
}
```

---

## 3. ApiService

**File:** `Services/ApiService.cs`  
**Namespace:** `YourApp.Services`

> Low-level HTTP wrapper. Automatically attaches the Bearer token before every call.  
> Register with `AddHttpClient<ApiService>` so the base address is injected.

```csharp
using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace YourApp.Services;

public class ApiService
{
    private readonly HttpClient _http;
    private readonly ITokenStorage _tokenStorage;

    public ApiService(HttpClient http, ITokenStorage tokenStorage)
    {
        _http = http;
        _tokenStorage = tokenStorage;
    }

    private async Task AttachTokenAsync()
    {
        var token = await _tokenStorage.GetTokenAsync();
        _http.DefaultRequestHeaders.Authorization = token != null
            ? new AuthenticationHeaderValue("Bearer", token)
            : null;
    }

    public async Task<T?> GetAsync<T>(string path)
    {
        await AttachTokenAsync();
        var response = await _http.GetAsync(path);
        if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
        {
            await _tokenStorage.ClearTokenAsync();
            return default;
        }
        if (!response.IsSuccessStatusCode) return default;
        return await response.Content.ReadFromJsonAsync<T>();
    }

    public async Task<T?> PostAsync<T>(string path, object body)
    {
        await AttachTokenAsync();
        var response = await _http.PostAsJsonAsync(path, body);
        if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
        {
            await _tokenStorage.ClearTokenAsync();
            return default;
        }
        if (!response.IsSuccessStatusCode) return default;
        return await response.Content.ReadFromJsonAsync<T>();
    }

    public async Task<T?> PatchAsync<T>(string path, object body)
    {
        await AttachTokenAsync();
        var response = await _http.PatchAsJsonAsync(path, body);
        if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
        {
            await _tokenStorage.ClearTokenAsync();
            return default;
        }
        if (!response.IsSuccessStatusCode) return default;
        return await response.Content.ReadFromJsonAsync<T>();
    }

    public async Task DeleteAsync(string path)
    {
        await AttachTokenAsync();
        var response = await _http.DeleteAsync(path);
        if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
            await _tokenStorage.ClearTokenAsync();
    }
}
```

---

## 4. AppStateService

**File:** `Services/AppStateService.cs`  
**Namespace:** `YourApp.Services`

> Holds the currently authenticated user in memory. Subscribe to `OnChange` to re-render UI.

```csharp
using YourApp.Models;

namespace YourApp.Services;

public class AppStateService
{
    public UserDto? CurrentUser { get; private set; }
    public bool IsAuthenticated => CurrentUser != null;
    public event Action? OnChange;

    public void SetUser(UserDto? user)
    {
        CurrentUser = user;
        OnChange?.Invoke();
    }
}
```

---

## 5. AuthService

**File:** `Services/AuthService.cs`  
**Namespace:** `YourApp.Services`

| Method | HTTP | Endpoint |
|---|---|---|
| `LoginAsync` | POST | `auth/login` |
| `RegisterAsync` | POST | `auth/register` |
| `TryRestoreSessionAsync` | GET | `auth/me` |
| `LogoutAsync` | *(local)* | — |

```csharp
using YourApp.Models;

namespace YourApp.Services;

public class AuthService
{
    private readonly ApiService _api;
    private readonly ITokenStorage _tokenStorage;
    private readonly AppStateService _state;

    public AuthService(ApiService api, ITokenStorage tokenStorage, AppStateService state)
    {
        _api = api;
        _tokenStorage = tokenStorage;
        _state = state;
    }

    public async Task<bool> LoginAsync(string email, string password)
    {
        var result = await _api.PostAsync<AuthResponse>("auth/login", new LoginRequest(email, password));
        if (result == null) return false;
        await _tokenStorage.SetTokenAsync(result.AccessToken);
        _state.SetUser(result.User);
        return true;
    }

    public async Task<bool> RegisterAsync(RegisterRequest req)
    {
        var result = await _api.PostAsync<AuthResponse>("auth/register", req);
        if (result == null) return false;
        await _tokenStorage.SetTokenAsync(result.AccessToken);
        _state.SetUser(result.User);
        return true;
    }

    public async Task LogoutAsync()
    {
        await _tokenStorage.ClearTokenAsync();
        _state.SetUser(null);
    }

    public async Task<bool> TryRestoreSessionAsync()
    {
        var token = await _tokenStorage.GetTokenAsync();
        if (string.IsNullOrEmpty(token)) return false;
        var user = await _api.GetAsync<UserDto>("auth/me");
        if (user == null)
        {
            await _tokenStorage.ClearTokenAsync();
            return false;
        }
        _state.SetUser(user);
        return true;
    }
}
```

---

## 6. ClientService

**File:** `Services/ClientService.cs`  
**Namespace:** `YourApp.Services`

| Method | HTTP | Endpoint |
|---|---|---|
| `GetClientsAsync` | GET | `clients?page&limit&sort&filter[tag]&filter[churn_risk]` |
| `SearchClientsAsync` | GET | `clients/search?q&limit` |
| `GetClientAsync` | GET | `clients/{id}` |
| `CreateClientAsync` | POST | `clients` |
| `UpdateClientAsync` | PATCH | `clients/{id}` |
| `DeleteClientAsync` | DELETE | `clients/{id}` |
| `GetNotesAsync` | GET | `clients/{id}/notes` |
| `AddNoteAsync` | POST | `clients/{id}/notes` |
| `DeleteNoteAsync` | DELETE | `clients/{id}/notes/{noteId}` |
| `GetAiInsightsAsync` | GET | `clients/{id}/ai` |
| `TriggerWinbackAsync` | POST | `clients/{id}/winback` |
| `SendMessageAsync` | POST | `clients/{id}/messages` |
| `GetMessagesAsync` | GET | `clients/{id}/messages` |
| `GetVisitsAsync` | GET | `clients/{id}/visits?page&limit` |
| `GetPaymentsAsync` | GET | `clients/{id}/payments?page&limit` |

```csharp
using YourApp.Models;

namespace YourApp.Services;

public class ClientService
{
    private readonly ApiService _api;

    public ClientService(ApiService api) => _api = api;

    public Task<PagedResult<ClientDto>?> GetClientsAsync(
        int page = 1,
        int limit = 50,
        string? sort = null,
        ClientTag? tag = null,
        ChurnRisk? churnRisk = null)
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

    public Task DeleteClientAsync(Guid id) =>
        _api.DeleteAsync($"clients/{id}");

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
```

---

## 7. BookingService

**File:** `Services/BookingService.cs`  
**Namespace:** `YourApp.Services`

| Method | HTTP | Endpoint |
|---|---|---|
| `GetBookingsAsync` | GET | `bookings?page&limit&from&to&staffId` |
| `GetBookingAsync` | GET | `bookings/{id}` |
| `CreateBookingAsync` | POST | `bookings` |
| `UpdateBookingAsync` | PATCH | `bookings/{id}` |
| `CancelBookingAsync` | DELETE | `bookings/{id}` |
| `CompleteBookingAsync` | POST | `bookings/{id}/complete` |
| `NoShowBookingAsync` | POST | `bookings/{id}/no-show` |
| `GetAvailableSlotsAsync` | GET | `bookings/slots?serviceId&date&staffMemberId` |
| `GetServicesAsync` | GET | `services` |
| `GetStaffAsync` | GET | `staff` |

```csharp
using YourApp.Models;

namespace YourApp.Services;

public class BookingService
{
    private readonly ApiService _api;

    public BookingService(ApiService api) => _api = api;

    public Task<object?> GetBookingsAsync(
        DateTime? from = null,
        DateTime? to = null,
        Guid? staffId = null,
        int page = 1,
        int limit = 50)
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

    public Task CancelBookingAsync(Guid id) =>
        _api.DeleteAsync($"bookings/{id}");

    public Task<BookingDto?> CompleteBookingAsync(Guid id) =>
        _api.PostAsync<BookingDto>($"bookings/{id}/complete", new { });

    public Task<object?> NoShowBookingAsync(Guid id) =>
        _api.PostAsync<object>($"bookings/{id}/no-show", new { });

    public Task<IEnumerable<object>?> GetAvailableSlotsAsync(
        Guid serviceId,
        Guid? staffMemberId,
        DateTime date)
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
```

---

## 8. PaymentService

**File:** `Services/PaymentService.cs`  
**Namespace:** `YourApp.Services`

| Method | HTTP | Endpoint |
|---|---|---|
| `GetPaymentMethodsAsync` | GET | `payments/methods?clientId` |
| `ChargeCardAsync` | POST | `payments/charge` |
| `RecordCashAsync` | POST | `payments/cash` |
| `GeneratePaymentLinkAsync` | POST | `payments/payment-link` |
| `GetPayoutsAsync` | GET | `payouts?page&limit` |
| `GetPendingBalanceAsync` | GET | `payouts/pending` |

```csharp
using YourApp.Models;

namespace YourApp.Services;

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
```

---

## 9. AutoPilotService

**File:** `Services/AutoPilotService.cs`  
**Namespace:** `YourApp.Services`

| Method | HTTP | Endpoint |
|---|---|---|
| `GetStatusAsync` | GET | `autopilot` |
| `GetFlowsAsync` | GET | `autopilot/flows` |
| `UpdateFlowAsync` | PATCH | `autopilot/flows/{flowId}` |
| `UpdateGlobalAsync` | PATCH | `autopilot` |
| `GetEventsAsync` | GET | `autopilot/events?page&limit` |
| `GetStatsAsync` | GET | `autopilot/stats` |
| `GetRevenueAsync` | GET | `autopilot/revenue` |

```csharp
using YourApp.Models;

namespace YourApp.Services;

public class AutoPilotService
{
    private readonly ApiService _api;

    public AutoPilotService(ApiService api) => _api = api;

    public Task<AutoPilotStatusDto?> GetStatusAsync() =>
        _api.GetAsync<AutoPilotStatusDto>("autopilot");

    public Task<IEnumerable<FlowStatusDto>?> GetFlowsAsync() =>
        _api.GetAsync<IEnumerable<FlowStatusDto>>("autopilot/flows");

    public Task<object?> UpdateFlowAsync(string flowId, UpdateFlowRequest req) =>
        _api.PatchAsync<object>($"autopilot/flows/{flowId}", req);

    public Task<object?> UpdateGlobalAsync(bool enabled) =>
        _api.PatchAsync<object>("autopilot", new { GloballyEnabled = enabled });

    public Task<object?> GetEventsAsync(int page = 1, int limit = 50) =>
        _api.GetAsync<object>($"autopilot/events?page={page}&limit={limit}");

    public Task<AutoPilotStatsDto?> GetStatsAsync() =>
        _api.GetAsync<AutoPilotStatsDto>("autopilot/stats");

    public Task<object?> GetRevenueAsync() =>
        _api.GetAsync<object>("autopilot/revenue");
}
```

---

## 10. MessagingService

**File:** `Services/MessagingService.cs`  
**Namespace:** `YourApp.Services`

| Method | HTTP | Endpoint |
|---|---|---|
| `SendSmsAsync` | POST | `messaging/sms` |
| `SendEmailAsync` | POST | `messaging/email` |
| `SendBlastAsync` | POST | `messaging/blast` |
| `GetTemplatesAsync` | GET | `messaging/templates` |

```csharp
using YourApp.Models;

namespace YourApp.Services;

public class MessagingService
{
    private readonly ApiService _api;

    public MessagingService(ApiService api) => _api = api;

    public Task<object?> SendSmsAsync(SendSmsRequest req) =>
        _api.PostAsync<object>("messaging/sms", req);

    public Task<object?> SendEmailAsync(SendEmailRequest req) =>
        _api.PostAsync<object>("messaging/email", req);

    public Task<object?> SendBlastAsync(BlastRequest req) =>
        _api.PostAsync<object>("messaging/blast", req);

    public Task<IEnumerable<MessageTemplateDto>?> GetTemplatesAsync() =>
        _api.GetAsync<IEnumerable<MessageTemplateDto>>("messaging/templates");
}
```

---

## 11. DashboardService

**File:** `Services/DashboardService.cs`  
**Namespace:** `YourApp.Services`

| Method | HTTP | Endpoint |
|---|---|---|
| `GetTodayBriefAsync` | GET | `brief/today` |

```csharp
namespace YourApp.Services;

public class DashboardService
{
    private readonly ApiService _api;

    public DashboardService(ApiService api) => _api = api;

    public Task<object?> GetTodayBriefAsync() =>
        _api.GetAsync<object>("brief/today");
}
```

---

## 12. DI Registration

**File:** `ServiceCollectionExtensions.cs`  
**Namespace:** `YourApp`

> Call `AddYourAppServices(apiBaseUrl)` in `MauiProgram.cs` / `Program.cs`.  
> Provide a platform-specific `ITokenStorage` implementation **before** calling this.

```csharp
using Microsoft.Extensions.DependencyInjection;
using YourApp.Services;

namespace YourApp;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddYourAppServices(
        this IServiceCollection services,
        string apiBaseUrl)
    {
        services.AddScoped<AppStateService>();
        services.AddScoped<AuthService>();
        services.AddScoped<ClientService>();
        services.AddScoped<BookingService>();
        services.AddScoped<PaymentService>();
        services.AddScoped<MessagingService>();
        services.AddScoped<AutoPilotService>();
        services.AddScoped<DashboardService>();
        services.AddHttpClient<ApiService>(c => c.BaseAddress = new Uri(apiBaseUrl));
        return services;
    }
}
```


## 13. API Endpoint Summary

| Domain | Method | Path |
|---|---|---|
| **Auth** | POST | `auth/register` |
| | POST | `auth/login` |
| | GET | `auth/me` |
| **Clients** | GET | `clients` |
| | GET | `clients/search` |
| | POST | `clients` |
| | GET | `clients/{id}` |
| | PATCH | `clients/{id}` |
| | DELETE | `clients/{id}` |
| | GET | `clients/{id}/notes` |
| | POST | `clients/{id}/notes` |
| | DELETE | `clients/{id}/notes/{noteId}` |
| | GET | `clients/{id}/ai` |
| | POST | `clients/{id}/winback` |
| | GET/POST | `clients/{id}/messages` |
| | GET | `clients/{id}/visits` |
| | GET | `clients/{id}/payments` |
| **Bookings** | GET | `bookings` |
| | POST | `bookings` |
| | GET | `bookings/{id}` |
| | PATCH | `bookings/{id}` |
| | DELETE | `bookings/{id}` |
| | POST | `bookings/{id}/complete` |
| | POST | `bookings/{id}/no-show` |
| | GET | `bookings/slots` |
| **Services** | GET | `services` |
| **Staff** | GET | `staff` |
| **Payments** | GET | `payments/methods` |
| | POST | `payments/charge` |
| | POST | `payments/cash` |
| | POST | `payments/payment-link` |
| | GET | `payouts` |
| | GET | `payouts/pending` |
| **AutoPilot** | GET/PATCH | `autopilot` |
| | GET | `autopilot/flows` |
| | PATCH | `autopilot/flows/{flowId}` |
| | GET | `autopilot/events` |
| | GET | `autopilot/stats` |
| | GET | `autopilot/revenue` |
| **Messaging** | POST | `messaging/sms` |
| | POST | `messaging/email` |
| | POST | `messaging/blast` |
| | GET | `messaging/templates` |
| **Dashboard** | GET | `brief/today` |
