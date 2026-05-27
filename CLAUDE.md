# FlatPurse Barbershop App — CLAUDE.md

Guidance for Claude (and other AI agents) working on this codebase.
Read this file before making any changes.

---

## Project Overview

FlatPurse Flow is an AI-powered barbershop management platform.
The solution has **three projects** that share a single Razor Class Library for all UI and business logic.

| Project | Type | Purpose |
|---|---|---|
| `FlatPurse.Shared` | Razor Class Library (RCL) | All Blazor pages, components, services, interfaces, models, and CSS |
| `FlatPurse.Mobile` | .NET MAUI Blazor Hybrid | iOS, Android, Windows, macOS, Tizen native host |
| `FlatPurse.PublicWebs` | Blazor WebAssembly | Browser-hosted web app |

**Target framework:** .NET 9 · **Language:** C# 13

---

## Repository Layout

```
BARBERSHOP-APP/
├── CLAUDE.md                          ← you are here
├── SKILL.md                           ← developer quick-reference
├── .github/
│   └── copilot-instructions.md        ← Copilot project rules
│
├── FlatPurse.Shared/                  ← ALL shared code lives here
│   ├── Models/
│   │   └── AppModels.cs               ← every record, DTO, enum
│   ├── Services/
│   │   ├── IApiService / ApiService          ← sole HTTP gateway
│   │   ├── IAppStateService / AppStateService
│   │   ├── IAuthService / AuthService
│   │   ├── IBookingService / BookingService
│   │   ├── IClientService / ClientService
│   │   ├── IPaymentService / PaymentService
│   │   ├── IMessagingService / MessagingService
│   │   ├── IAutoPilotService / AutoPilotService
│   │   ├── IDashboardService / DashboardService
│   │   └── ITokenStorage                     ← platform-specific token + onboarding flag
│   │       ├── LocalStorageTokenStorage      ← WASM implementation
│   │       └── (SecureStorageTokenStorage in FlatPurse.Mobile)
│   ├── Components/
│   │   ├── App.razor                  ← session restore + first-visit routing
│   │   ├── Layout/
│   │   │   ├── AuthLayout.razor       ← unauthenticated pages
│   │   │   ├── MainLayout.razor       ← authenticated shell
│   │   │   ├── NavSidebar.razor       ← desktop sidebar navigation
│   │   │   └── MobileNavBottom.razor  ← mobile bottom tab bar
│   │   ├── Pages/
│   │   │   ├── Auth/           Login.razor, Register.razor
│   │   │   ├── AutoPilot/      AutoPilotDashboard.razor
│   │   │   ├── BarberMode/     BarberMode.razor
│   │   │   ├── Bookings/       BookingList, NewBooking, BookingSuccess
│   │   │   ├── Clients/        ClientList, ClientDetail
│   │   │   ├── Dashboard.razor
│   │   │   ├── Messaging/      MessagingHub.razor
│   │   │   ├── Onboarding/     Onboarding, SetupWizard, SwStep* (14 steps)
│   │   │   ├── Operations/     OperationsPage.razor
│   │   │   ├── Payments/       PaymentList, Checkout, PaymentSuccess
│   │   │   ├── Reports/        ReportsPage.razor
│   │   │   ├── Settings/       SettingsPage.razor
│   │   │   └── Team/           TeamPage.razor
│   │   └── Shared/
│   │       ├── StatCard.razor
│   │       ├── BookingRow.razor
│   │       ├── ClientCard.razor
│   │       ├── EmptyState.razor
│   │       └── LoadingSpinner.razor
│   ├── ServiceCollectionExtensions.cs ← registers all shared services
│   └── wwwroot/app.css                ← all styles (utility-class approach)
│
├── FlatPurse.Mobile/
│   ├── MauiProgram.cs
│   ├── MobileServiceExtensions.cs     ← registers SecureStorageTokenStorage + shared services
│   ├── Services/
│   │   └── SecureStorageTokenStorage.cs
│   └── wwwroot/index.html             ← loads _content/FlatPurse.Shared/app.css
│
└── FlatPurse.PublicWebs/
    └── Program.cs                     ← registers LocalStorageTokenStorage + shared services
```

---

## Architecture Rules — Non-Negotiable

### 1. Shared-first
- **All** Blazor pages, components, services, models → `FlatPurse.Shared`.
- Host projects (`FlatPurse.Mobile`, `FlatPurse.PublicWebs`) contain **only** host bootstrapping and platform token storage.
- Never add UI or business logic to a host project.

### 2. Single HTTP gateway
- Every network call goes through `IApiService` / `ApiService`.
- **Never** create a raw `HttpClient` inside a page, component, or service.
- `ApiService` attaches the Bearer token before every request and clears it on 401.

### 3. Platform token storage via `ITokenStorage`
- `ITokenStorage` now has **five methods**:

```csharp
Task<string?>  GetTokenAsync();
Task           SetTokenAsync(string token);
Task           ClearTokenAsync();
Task<bool>     HasSeenOnboardingAsync();   // first-visit routing flag
Task           MarkOnboardingSeenAsync();  // called by Onboarding.razor on load
```

- WASM → `LocalStorageTokenStorage` (uses `localStorage` keys `auth_token`, `onboarding_seen`)
- MAUI → `SecureStorageTokenStorage` (uses `SecureStorage` keys `auth_token`, `onboarding_seen`)

### 4. Services are Scoped
- Register as `Scoped`, never `Singleton` for anything user-session-related.

### 5. All DTOs are records
- Defined in `AppModels.cs`.
- Use `record` (immutable, value semantics) for every DTO / request / response.
- Use `PagedResult<T>` for every paginated list.

---

## Navigation & First-Visit Flow

`App.razor` controls startup routing:

```
App starts
  └─ TryRestoreSessionAsync()
       ├─ success → user lands on requested route (session intact)
       └─ failure → HasSeenOnboardingAsync()?
               ├─ false (brand-new user)  → /welcome   (Onboarding)
               └─ true  (returning user)  → /login
```

- `Onboarding.razor` calls `MarkOnboardingSeenAsync()` in `OnInitializedAsync` — even if the wizard is abandoned mid-flow, the user won't see `/welcome` again.
- After successful login/register, `AuthService` sets the user in `AppStateService` and pages navigate to `/dashboard`.
- Protected pages guard with:

```razor
@if (!AppState.IsAuthenticated)
{
    <span></span>
    return;
}
```
and a `OnInitialized` redirect:
```csharp
protected override void OnInitialized()
{
    if (!AppState.IsAuthenticated)
        Nav.NavigateTo("/login");
}
```

---

## Service Registration

```csharp
// WASM (FlatPurse.PublicWebs/Program.cs)
builder.Services.AddFlatPurseWebServices(apiBaseUrl);
// → registers LocalStorageTokenStorage + all shared services

// MAUI (FlatPurse.Mobile/MauiProgram.cs)
builder.Services.AddFlatPurseMobileServices(apiBaseUrl);
// → registers SecureStorageTokenStorage + all shared services
```

`AddFlatPurseServices` (shared, called by both above) registers:
```
IAppStateService, IAuthService, IClientService, IBookingService,
IPaymentService, IMessagingService, IAutoPilotService, IDashboardService,
IApiService (HttpClient with base address)
```

---

## Adding a New Feature — Checklist

1. **Record(s)** — add request/response records to `AppModels.cs`.
2. **Interface** — create `IMyFeatureService.cs` in `FlatPurse.Shared/Services/`.
3. **Service** — implement `MyFeatureService.cs`; use `IApiService` for all HTTP; `ConfigureAwait(false)` on every `await`.
4. **Register** — add `services.AddScoped<IMyFeatureService, MyFeatureService>()` inside `AddFlatPurseServices`.
5. **Page** — add `.razor` to `Components/Pages/<Domain>/`; set `@page "/route"`; use `AuthLayout` or `MainLayout` via `@layout`.
6. **Navigation** — add entry to `NavSidebar.razor` (desktop) and `MobileNavBottom.razor` (mobile) if it needs a nav link.

---

## Coding Standards

| Rule | Detail |
|---|---|
| Access modifiers | `private` > `internal` > `protected` > `public` (least exposure) |
| Async | Every async method ends with `Async`; always `await`; pass `CancellationToken` where practical |
| `ConfigureAwait` | `ConfigureAwait(false)` in all service methods |
| Null guards | `ArgumentNullException.ThrowIfNull(x)` for objects; `string.IsNullOrWhiteSpace` for strings |
| `StateHasChanged()` | Only call from outside the normal render cycle (e.g. event callbacks from non-Blazor code) |
| CSS | Add styles to `wwwroot/app.css` — class-based only; no inline `style=` except dynamic values (avatar colours, etc.) |
| Comments | Explain **why**, not what |
| No dead code | Don't add unused methods, parameters, or using directives |

---

## Key Models Quick Reference

```csharp
// Auth
record LoginRequest(string Email, string Password);
record RegisterRequest(string FirstName, string LastName, string Email,
                       string Password, string BusinessName, string? City, string? BusinessType);
record AuthResponse(string AccessToken, UserDto User);
record UserDto(string Id, string FirstName, string LastName, string Email,
               string? Phone, string? AvatarUrl, StaffRole Role,
               Guid? BusinessId, BusinessSummaryDto? Business);

// Paging
record PagedResult<T>(List<T> Items, int Total, int Page, int Limit);

// Clients
record ClientDto(Guid Id, string FirstName, string LastName, string? Email,
                 string? Phone, string? AvatarUrl, List<ClientTag> Tags,
                 ChurnRisk ChurnRisk, decimal LifetimeValue,
                 int VisitCount, DateTime? LastVisitAt, DateTime CreatedAt);

// Bookings
record BookingDto(Guid Id, Guid ClientId, string ClientName, Guid ServiceId,
                  string ServiceName, Guid StaffMemberId, string StaffName,
                  DateTime StartsAt, DateTime EndsAt, BookingStatus Status,
                  decimal Price, string? Notes, DateTime CreatedAt);

// Payments
record PaymentDto(Guid Id, Guid BookingId, decimal Amount, decimal TipAmount,
                  decimal PlatformFee, decimal NetAmount,
                  PaymentStatus Status, PaymentMethod Method, DateTime CreatedAt);
```

---

## Enums Quick Reference

```
BookingStatus   : Pending | Confirmed | InProgress | Completed | Cancelled | NoShow
PaymentMethod   : Card | Cash | TapToPay | PaymentLink | Interac
PaymentStatus   : Pending | Succeeded | Failed | Refunded | PartialRefund
StaffRole       : Owner | Manager | Stylist | Receptionist
ClientTag       : VIP | NewClient | Inactive | HighSpender | FrequentCanceller
ChurnRisk       : Low | Medium | High
ChannelType     : Instagram | Facebook | WhatsApp | Google | Email | SMS
ChannelStatus   : Connected | Disconnected | Error
SubscriptionPlan: Starter | Growth | Scale
AutoPilotFlowId : RebookReminder | SlotFiller | Winback | NoShowRecovery |
                  BirthdayOffer | UpsellPrompt | ReviewRequest |
                  FamilyHours | CancellationAlert | ChurnAlert
```

---

## Feature Domains

| Domain | Route(s) | Page(s) | Service |
|---|---|---|---|
| Auth | `/login` `/register` | Login, Register | `IAuthService` |
| Dashboard | `/` `/dashboard` | Dashboard | `IDashboardService` |
| Bookings | `/bookings` `/bookings/new` `/bookings/success` | BookingList, NewBooking, BookingSuccess | `IBookingService` |
| Clients | `/clients` `/clients/{id}` | ClientList, ClientDetail | `IClientService` |
| Payments | `/payments` `/checkout` `/payments/success` | PaymentList, Checkout, PaymentSuccess | `IPaymentService` |
| Messaging | `/messaging` | MessagingHub | `IMessagingService` |
| AutoPilot | `/autopilot` | AutoPilotDashboard | `IAutoPilotService` |
| Onboarding | `/welcome` `/setup` | Onboarding, SetupWizard, SwStep* | — |
| BarberMode | `/barber-mode` | BarberMode | — |
| Operations | `/operations` | OperationsPage | — |
| Reports | `/reports` | ReportsPage | — |
| Settings | `/settings` | SettingsPage | — |
| Team | `/team` | TeamPage | — |

---

## What NOT to Do

- ❌ Add platform-specific code to `FlatPurse.Shared`
- ❌ Create a raw `HttpClient` anywhere outside `ApiService`
- ❌ Use mutable `class` for a DTO — always use `record`
- ❌ Add `Singleton` services that hold user-session state
- ❌ Add new NuGet packages without verifying the need is not already met
- ❌ Change `<TargetFramework>`, SDK version, or `<LangVersion>` unless explicitly requested
- ❌ Edit auto-generated files (`*.g.cs`, anything under `obj/`)
- ❌ Call `StateHasChanged()` inside `OnInitializedAsync` — not needed in normal render cycles
- ❌ Bypass `IApiService` to make HTTP calls from a component or page directly

---

## API Base URL Configuration

| Host | Where it's set |
|---|---|
| MAUI | `MauiProgram.cs` → `var apiBaseUrl = "https://localhost:7001/"` |
| WASM | `appsettings.json` key `ApiBaseUrl`; falls back to `HostEnvironment.BaseAddress` |

---

## CSS Class Conventions (app.css)

| Class pattern | Usage |
|---|---|
| `.stat-card` / `.stat-row` | Dashboard KPI tiles |
| `.card` / `.card-header` / `.card-title` | Content cards |
| `.badge-purple` / `.badge-green` / `.badge-red` | Status badges |
| `.btn` / `.btn-primary` / `.btn-secondary` | Buttons |
| `.form-group` / `.form-input` / `.form-label` | Form elements |
| `.auth-card` / `.auth-page` | Login / Register wrapper |
| `.onboarding-page` / `.onboarding-card` | Welcome / Onboarding wrapper |
| `.schedule-item` / `.appt-*` | Booking schedule rows |
| `platform-mobile` (on `<body>`) | MAUI-specific layout adjustments |
