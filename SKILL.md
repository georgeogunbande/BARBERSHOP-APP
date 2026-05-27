# FlatPurse Barbershop App – Skill Reference

A quick-reference skill document for AI agents and developers working on this codebase.

---

## Stack

| Layer | Technology |
|---|---|
| Target Framework | .NET 9 |
| UI (Web) | Blazor WebAssembly (`FlatPurse.PublicWebs`) |
| UI (Mobile) | .NET MAUI Blazor Hybrid (`FlatPurse.Mobile`) |
| Shared UI + Logic | Razor Class Library (`FlatPurse.Shared`) |
| Language | C# 13 |
| HTTP | `HttpClient` via `IApiService` / `ApiService` |
| Auth | JWT Bearer token; stored via `ITokenStorage` |
| Token Storage (WASM) | `LocalStorageTokenStorage` (browser localStorage) |
| Token Storage (MAUI) | `SecureStorageTokenStorage` (platform secure storage) |
| DI | `Microsoft.Extensions.DependencyInjection` |
| CSS | Custom utility classes in `app.css` (no Tailwind/Bootstrap) |

---

## Project Structure

```
BARBERSHOP-APP/
├── FlatPurse.Shared/               # RCL — all shared code lives here
│   ├── Components/
│   │   ├── App.razor
│   │   ├── Layout/                 # MainLayout, AuthLayout, NavSidebar, MobileNavBottom
│   │   ├── Pages/                  # Feature pages grouped by domain
│   │   │   ├── Auth/               # Login, Register
│   │   │   ├── AutoPilot/
│   │   │   ├── BarberMode/
│   │   │   ├── Bookings/
│   │   │   ├── Clients/
│   │   │   ├── Messaging/
│   │   │   ├── Onboarding/         # SetupWizard + SwStep* step components
│   │   │   ├── Operations/
│   │   │   ├── Payments/
│   │   │   ├── Reports/
│   │   │   ├── Settings/
│   │   │   └── Team/
│   │   └── Shared/                 # Reusable widgets: StatCard, BookingRow, ClientCard, EmptyState, LoadingSpinner
│   ├── Models/
│   │   └── AppModels.cs            # All records, DTOs, enums
│   ├── Services/
│   │   ├── IApiService.cs / ApiService.cs          # HTTP gateway
│   │   ├── IAppStateService.cs / AppStateService.cs
│   │   ├── IAuthService.cs / AuthService.cs
│   │   ├── IBookingService.cs / BookingService.cs
│   │   ├── IClientService.cs / ClientService.cs
│   │   ├── IPaymentService.cs / PaymentService.cs
│   │   ├── IMessagingService.cs / MessagingService.cs
│   │   ├── IAutoPilotService.cs / AutoPilotService.cs
│   │   ├── IDashboardService.cs / DashboardService.cs
│   │   └── ITokenStorage.cs / LocalStorageTokenStorage.cs
│   ├── ServiceCollectionExtensions.cs
│   └── wwwroot/app.css
├── FlatPurse.Mobile/               # MAUI host
│   ├── MauiProgram.cs
│   ├── MobileServiceExtensions.cs
│   └── Services/SecureStorageTokenStorage.cs
└── FlatPurse.PublicWebs/           # WASM host
    └── Program.cs
```

---

## Service Registration

```csharp
// In any host project's Program.cs / MauiProgram.cs:

// WASM
services.AddFlatPurseWebServices(apiBaseUrl);

// MAUI
services.AddScoped<ITokenStorage, SecureStorageTokenStorage>();
services.AddFlatPurseServices(apiBaseUrl);
```

---

## Adding a New Feature – Checklist

1. **Model** – Add request/response `record` types to `AppModels.cs`.
2. **Interface** – Create `IMyFeatureService.cs` in `FlatPurse.Shared\Services\`.
3. **Service** – Implement `MyFeatureService.cs` using `IApiService` for HTTP calls.
4. **Register** – Add `services.AddScoped<IMyFeatureService, MyFeatureService>()` in `ServiceCollectionExtensions.AddFlatPurseServices`.
5. **Page** – Add `.razor` file to `Components\Pages\<Domain>\` with `@page "/route"`.
6. **Navigation** – Add route to `NavSidebar.razor` (desktop) and `MobileNavBottom.razor` (mobile) if needed.

---

## Common Patterns

### Authenticated page guard
```razor
@inject IAppStateService AppState
@inject NavigationManager Nav

@if (!AppState.IsAuthenticated)
{
    <span></span>
    return;
}
```

### Calling the API from a service
```csharp
public async Task<MyDto?> GetMyDataAsync(Guid id)
{
    return await _api.GetAsync<MyDto>($"/api/my-endpoint/{id}").ConfigureAwait(false);
}
```

### Paged list
```csharp
var result = await _api.GetAsync<PagedResult<ClientDto>>($"/api/clients?page={page}&limit={limit}");
```

---

## Key Records (AppModels.cs)

```csharp
// Auth
record LoginRequest(string Email, string Password);
record AuthResponse(string AccessToken, UserDto User);
record UserDto(string Id, string FirstName, string LastName, string Email,
               string? Phone, string? AvatarUrl, StaffRole Role,
               Guid? BusinessId, BusinessSummaryDto? Business);

// Clients
record ClientDto(Guid Id, string FirstName, string LastName, string? Email,
                 string? Phone, string? AvatarUrl, List<ClientTag> Tags,
                 ChurnRisk ChurnRisk, decimal LifetimeValue,
                 int VisitCount, DateTime? LastVisitAt, DateTime CreatedAt);

// Paging
record PagedResult<T>(List<T> Items, int Total, int Page, int Limit);
```

---

## Enums Quick Reference

```csharp
BookingStatus  : Pending | Confirmed | InProgress | Completed | Cancelled | NoShow
PaymentMethod  : Card | Cash | TapToPay | PaymentLink | Interac
PaymentStatus  : Pending | Succeeded | Failed | Refunded | PartialRefund
StaffRole      : Owner | Manager | Stylist | Receptionist
ClientTag      : VIP | NewClient | Inactive | HighSpender | FrequentCanceller
ChurnRisk      : Low | Medium | High
AutoPilotFlowId: RebookReminder | SlotFiller | Winback | NoShowRecovery |
                 BirthdayOffer | UpsellPrompt | ReviewRequest |
                 FamilyHours | CancellationAlert | ChurnAlert
ChannelType    : Instagram | Facebook | WhatsApp | Google | Email | SMS
SubscriptionPlan: Starter | Growth | Scale
```

---

## CSS Conventions

- All styles are in `FlatPurse.Shared\wwwroot\app.css`.
- Use class-based utility styles (`.stat-card`, `.card`, `.badge-purple`, etc.).
- Inline `style=` is only acceptable for dynamic values (e.g., avatar background color).
- Do not introduce external CSS frameworks (Bootstrap, Tailwind) without team agreement.

---

## Anti-patterns to Avoid

| Anti-pattern | Correct approach |
|---|---|
| Creating `HttpClient` directly in a component | Inject and use `IApiService` |
| Adding UI pages to `FlatPurse.Mobile` or `FlatPurse.PublicWebs` | Add to `FlatPurse.Shared` |
| Using mutable `class` for a DTO | Use `record` |
| Fire-and-forget async calls | Always `await` and pass `CancellationToken` |
| `StateHasChanged()` in `OnInitializedAsync` | Not needed; only use for out-of-cycle events |
| Hard-coding API base URL in a service | Always use `IApiService` which is configured at startup |
