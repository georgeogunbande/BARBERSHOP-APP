- @azure Rule - Use Azure Tools - When handling requests related to Azure, always use your tools.
- @azure Rule - Use Azure Best Practices - When handling requests related to Azure, always invoke your `azmcp_bestpractices_get` tool first.
- @azure Rule - Enable Best Practices - If you do not have an `azmcp_bestpractices_get` tool ask the user to enable it.

# FlatPurse Barbershop App – Project Instructions

## Project Overview
FlatPurse is a barbershop management platform built with:
- **FlatPurse.Shared** – Razor Class Library (RCL) containing all Blazor components, pages, services, interfaces, and models. Shared by both host projects.
- **FlatPurse.Mobile** – .NET MAUI Blazor Hybrid app (iOS, Android, Windows, macOS, Tizen).
- **FlatPurse.PublicWebs** – Blazor WebAssembly app (browser-hosted).

Target framework: **.NET 9**. C# 13.

---

## Architecture Rules

### Shared-first
- All Blazor pages, components, services, and models live in **FlatPurse.Shared**.
- Host projects (`FlatPurse.Mobile`, `FlatPurse.PublicWebs`) only contain host-specific bootstrapping and platform-specific token storage.
- Never add business logic or UI components directly to a host project.

### Service Layer
- Every service has a matching interface in `FlatPurse.Shared\Services\I*.cs`.
- All services are registered via `ServiceCollectionExtensions.AddFlatPurseServices(...)`.
- `IApiService` / `ApiService` is the single HTTP gateway; use it for all backend calls.
- Token storage is platform-specific: `LocalStorageTokenStorage` (WASM) and `SecureStorageTokenStorage` (MAUI).
- Services are `Scoped`; do not use `Singleton` for user-session state.

### Models
- All DTOs and request/response records are in `FlatPurse.Shared\Models\AppModels.cs`.
- Use C# `record` types for all DTOs (immutable, value semantics).
- Use `PagedResult<T>` for any paginated list response.
- Do not add mutable classes for data transfer; prefer records.

### Component Conventions
- Page routes are defined with `@page` directives on `.razor` files in `Components/Pages/`.
- Shared UI widgets go in `Components/Shared/` (e.g., `StatCard`, `EmptyState`, `LoadingSpinner`).
- Layouts are in `Components/Layout/`; use `AuthLayout` for unauthenticated pages, `MainLayout` for authenticated.
- Always inject `IAppStateService` to check `AppState.IsAuthenticated` before rendering protected content.
- Redirect unauthenticated users to `/login` via `NavigationManager`.

---

## Coding Standards

- Least exposure rule: `private` > `internal` > `protected` > `public`.
- Use `ConfigureAwait(false)` in all service methods.
- Use `ArgumentNullException.ThrowIfNull` for null guards.
- All async methods must end with `Async`.
- Do not use `StateHasChanged()` unless responding to an event from outside the render cycle.
- CSS is utility-first, class-based; add styles to `FlatPurse.Shared\wwwroot\app.css` — do not use inline `style=` except for dynamic values (e.g., avatar color).
- Comments explain **why**, not what.
- Don't add unused methods or parameters.

---

## Feature Domains
| Domain | Pages | Service |
|---|---|---|
| Auth | `Login`, `Register` | `IAuthService` |
| Dashboard | `Dashboard` | `IDashboardService` |
| Bookings | `BookingList`, `NewBooking`, `BookingSuccess` | `IBookingService` |
| Clients | `ClientList`, `ClientDetail` | `IClientService` |
| Payments | `PaymentList`, `Checkout`, `PaymentSuccess` | `IPaymentService` |
| Messaging | `MessagingHub` | `IMessagingService` |
| AutoPilot | `AutoPilotDashboard` | `IAutoPilotService` |
| Onboarding | `Onboarding`, `SetupWizard`, `SwStep*` | – |
| Settings | `SettingsPage` | – |
| Reports | `ReportsPage` | – |
| Team | `TeamPage` | – |
| BarberMode | `BarberMode` | – |
| Operations | `OperationsPage` | – |

---

## Key Enums (AppModels.cs)
- `BookingStatus`: Pending, Confirmed, InProgress, Completed, Cancelled, NoShow
- `PaymentMethod`: Card, Cash, TapToPay, PaymentLink, Interac
- `PaymentStatus`: Pending, Succeeded, Failed, Refunded, PartialRefund
- `AutoPilotFlowId`: RebookReminder, SlotFiller, Winback, NoShowRecovery, BirthdayOffer, UpsellPrompt, ReviewRequest, FamilyHours, CancellationAlert, ChurnAlert
- `ChannelType`: Instagram, Facebook, WhatsApp, Google, Email, SMS
- `StaffRole`: Owner, Manager, Stylist, Receptionist
- `SubscriptionPlan`: Starter, Growth, Scale

---

## Do / Don't

**Do:**
- Add new pages to `FlatPurse.Shared\Components\Pages\<Domain>\`.
- Add new services with a matching interface and register in `ServiceCollectionExtensions`.
- Reuse `EmptyState`, `LoadingSpinner`, `StatCard`, `BookingRow`, `ClientCard` components.
- Use `PagedResult<T>` for all list endpoints.

**Don't:**
- Don't add platform-specific code to `FlatPurse.Shared`.
- Don't bypass `IApiService`; never create a raw `HttpClient` in a page or component.
- Don't add new NuGet packages without checking if the functionality already exists in the project.
- Don't change `<TargetFramework>`, SDK, or `<LangVersion>` unless explicitly asked.
- Don't edit auto-generated files (`*.g.cs`, `obj/`).
