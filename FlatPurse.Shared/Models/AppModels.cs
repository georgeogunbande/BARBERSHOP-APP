namespace FlatPurse.Models;

// ── Enums ─────────────────────────────────────────────────────────────────────

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

// ── Auth ─────────────────────────────────────────────────────────────────────

public record RegisterRequest(string FirstName, string LastName, string Email, string Password, string BusinessName, string? City, string? BusinessType);
public record LoginRequest(string Email, string Password);

public record AuthResponse(string AccessToken, UserDto User);
public record UserDto(string Id, string FirstName, string LastName, string Email, string? Phone, string? AvatarUrl, StaffRole Role, Guid? BusinessId, BusinessSummaryDto? Business);
public record BusinessSummaryDto(Guid Id, string Name, string? City, string? Type, string? LogoUrl, string? BookingHandle, SubscriptionPlan Plan);

// ── Business ─────────────────────────────────────────────────────────────────

public record BusinessDto(Guid Id, string Name, string? City, string? Type, string? LogoUrl, string? CoverPhotoUrl, string? BookingHandle, string? ActiveTheme, string? Currency, DateTime CreatedAt);

// ── Clients ───────────────────────────────────────────────────────────────────

public record CreateClientRequest(string FirstName, string LastName, string? Email, string? Phone, DateTime? DateOfBirth);
public record UpdateClientRequest(string? FirstName, string? LastName, string? Email, string? Phone, DateTime? DateOfBirth, List<ClientTag>? Tags, int? RebookIntervalDays);
public record AddNoteRequest(string Content, bool IsPinned = false);
public record SendMessageRequest(string Body, MessageChannel Channel, string? Subject = null);

public record ClientDto(Guid Id, string FirstName, string LastName, string? Email, string? Phone, string? AvatarUrl, List<ClientTag> Tags, ChurnRisk ChurnRisk, decimal LifetimeValue, int VisitCount, DateTime? LastVisitAt, DateTime CreatedAt);
public record ClientNoteDto(Guid Id, string Content, bool IsPinned, string AuthorUserId, DateTime CreatedAt, DateTime UpdatedAt);
public record ClientAiInsightDto(ChurnRisk ChurnRisk, decimal PredictedLtv, List<string> UpsellOpportunities, string? WinbackMessage, DateTime UpdatedAt);
public record PagedResult<T>(List<T> Items, int Total, int Page, int Limit);

// ── Bookings ──────────────────────────────────────────────────────────────────

public record CreateBookingRequest(Guid ClientId, Guid ServiceId, Guid StaffMemberId, DateTime StartsAt, string? Notes);
public record UpdateBookingRequest(DateTime? StartsAt, Guid? StaffMemberId, string? Notes);

public record BookingDto(Guid Id, Guid ClientId, string ClientName, Guid ServiceId, string ServiceName, Guid StaffMemberId, string StaffName, DateTime StartsAt, DateTime EndsAt, BookingStatus Status, decimal Price, string? Notes, DateTime CreatedAt);
public record TimeSlotDto(DateTime StartsAt, DateTime EndsAt, Guid StaffId, string StaffName);

// ── Services ──────────────────────────────────────────────────────────────────

public record ServiceDto(Guid Id, string Name, decimal Price, int DurationMins, string? Category, bool Active, decimal DepositPct, int BookingCount, DateTime CreatedAt);

// ── Staff ─────────────────────────────────────────────────────────────────────

public record StaffDto(Guid Id, string FirstName, string LastName, string? Email, string? Phone, string? AvatarUrl, string? Colour, StaffRole Role, bool IsActive, List<Guid> ServiceIds);

// ── Payments ──────────────────────────────────────────────────────────────────

public record ChargeRequest(Guid BookingId, Guid ClientId, string StripePaymentMethodId, decimal Amount, decimal TipAmount = 0);
public record RecordCashPaymentRequest(Guid BookingId, decimal Amount, decimal TipAmount = 0);
public record GeneratePaymentLinkRequest(Guid BookingId, decimal Amount, string? Note);

public record PaymentMethodDto(Guid Id, string Brand, string Last4, int ExpMonth, int ExpYear, bool IsDefault);
public record PaymentDto(Guid Id, Guid BookingId, decimal Amount, decimal TipAmount, decimal PlatformFee, decimal NetAmount, PaymentStatus Status, PaymentMethod Method, DateTime CreatedAt);
public record PaymentLinkResponse(string Token, string Url);

// ── AutoPilot ─────────────────────────────────────────────────────────────────

public record UpdateFlowRequest(bool IsEnabled, string? CustomSettings);

public record AutoPilotStatusDto(bool GloballyEnabled, List<FlowStatusDto> Flows);
public record FlowStatusDto(AutoPilotFlowId FlowId, string Name, string Description, bool IsEnabled, string Trigger, string Action);
public record AutoPilotEventDto(Guid Id, AutoPilotFlowId FlowId, string FlowName, Guid? ClientId, string? ClientName, string? Description, bool WasSuccessful, decimal? RevenueRecovered, DateTime CreatedAt);
public record AutoPilotStatsDto(int SlotsFilled, int MessagesSent, int WinbacksTriggered, int ReviewsRequested, int NoShowsRecovered, decimal TotalRevenueRecovered);

// ── Messaging ─────────────────────────────────────────────────────────────────

public record SendSmsRequest(Guid ClientId, string Message);
public record SendEmailRequest(Guid ClientId, string Subject, string Body);
public record BlastRequest(string Message, List<ClientTag>? Tags, ChurnRisk? ChurnRisk);

public record MessageTemplateDto(Guid Id, string Name, string Subject, string Body, MessageChannel Channel, bool IsActive, DateTime CreatedAt);
public record ChannelDto(Guid Id, ChannelType Type, ChannelStatus Status, string? Handle, string? ExternalAccountName, DateTime? ConnectedAt);

// ── Dashboard ─────────────────────────────────────────────────────────────────

public record DailyBriefDto(DateTime Date, int AppointmentsToday, decimal RevenueTodayProjected, List<BookingDto> UpcomingBookings, List<string> AutoPilotHighlights, List<string> Alerts);

// ── Settings ─────────────────────────────────────────────────────────────────

public record BusinessSettingsDto(BusinessDto Business, BookingSettingsDto Booking, DepositSettingsDto Deposit, NotificationSettingsDto Notifications);
public record BookingSettingsDto(int MinAdvanceNoticeHours, int MaxAdvanceDays, bool AllowPublicBooking, bool RequireDeposit);
public record DepositSettingsDto(decimal DefaultDepositPct);
public record NotificationSettingsDto(bool BookingConfirmations, bool BookingReminders, bool PaymentReceipts, bool AutoPilotAlerts);
public record SubscriptionDto(SubscriptionPlan Plan, bool IsTrialing, DateTime? TrialEndsAt, DateTime? CurrentPeriodEnd, bool IsActive);
