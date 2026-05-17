using BarbershopApi.Models.Enums;

namespace BarbershopApi.DTOs;

// ── Auth ─────────────────────────────────────────────────────────────────────

public record RegisterRequest(string FirstName, string LastName, string Email, string Password, string BusinessName, string? City, string? BusinessType);
public record LoginRequest(string Email, string Password);
public record MagicLinkRequest(string Email);
public record RefreshTokenRequest(string? RefreshToken);
public record ForgotPasswordRequest(string Email);
public record ResetPasswordRequest(string Token, string Email, string NewPassword);
public record UpdateProfileRequest(string? FirstName, string? LastName, string? Phone, string? AvatarUrl);
public record InviteStaffRequest(string Email, StaffRole Role);
public record AcceptInviteRequest(string Password, string FirstName, string LastName);

public record AuthResponse(string AccessToken, UserDto User);
public record UserDto(string Id, string FirstName, string LastName, string Email, string? Phone, string? AvatarUrl, StaffRole Role, Guid? BusinessId, BusinessSummaryDto? Business);
public record BusinessSummaryDto(Guid Id, string Name, string? City, string? Type, string? LogoUrl, string? BookingHandle, SubscriptionPlan Plan);

// ── Business ─────────────────────────────────────────────────────────────────

public record UpdateBusinessRequest(string? Name, string? City, string? Type);
public record SetBookingHandleRequest(string Handle);
public record UpdateHoursRequest(List<DayHoursDto> Hours);
public record DayHoursDto(DayOfWeek DayOfWeek, bool IsClosed, TimeOnly? OpenTime, TimeOnly? CloseTime);
public record UpdateFamilyHoursRequest(bool IsEnabled, TimeOnly? StartTime, TimeOnly? EndTime, List<DayOfWeek>? Days, string? Message);
public record SetThemeRequest(string Theme);

public record BusinessDto(Guid Id, string Name, string? City, string? Type, string? LogoUrl, string? CoverPhotoUrl, string? BookingHandle, string? ActiveTheme, string? Currency, DateTime CreatedAt);
public record BookingLinkDto(string Url, string Handle, string QrCodeUrl);
public record OnboardingStatusDto(bool HasServices, bool HasStaff, bool HasHours, bool HasBookingHandle, bool HasPayments, bool HasTheme, int CompletionPercent);

// ── Services ──────────────────────────────────────────────────────────────────

public record CreateServiceRequest(string Name, decimal Price, int DurationMins, Guid? CategoryId, decimal DepositPct = 0);
public record UpdateServiceRequest(string? Name, decimal? Price, int? DurationMins, Guid? CategoryId, decimal? DepositPct, bool? Active);
public record SortServicesRequest(List<Guid> ServiceIds);
public record CreateCategoryRequest(string Name);

public record ServiceDto(Guid Id, string Name, decimal Price, int DurationMins, string? Category, bool Active, decimal DepositPct, int BookingCount, DateTime CreatedAt);
public record ServiceCategoryDto(Guid Id, string Name, int SortOrder, List<ServiceDto> Services);

// ── Staff ─────────────────────────────────────────────────────────────────────

public record CreateStaffRequest(string FirstName, string LastName, string Email, StaffRole Role, string? Colour, List<Guid>? ServiceIds);
public record UpdateStaffRequest(string? FirstName, string? LastName, StaffRole? Role, string? Colour, List<Guid>? ServiceIds);
public record UpdateScheduleRequest(List<ScheduleDayDto> Schedule);
public record ScheduleDayDto(DayOfWeek DayOfWeek, bool IsWorkingDay, TimeOnly? StartTime, TimeOnly? EndTime);

public record StaffDto(Guid Id, string FirstName, string LastName, string? Email, string? Phone, string? AvatarUrl, string? Colour, StaffRole Role, bool IsActive, List<Guid> ServiceIds);
public record StaffMetricsDto(decimal TotalRevenue, decimal AverageTicket, decimal RebookRate, decimal UpsellRate, int AppointmentsCompleted, int NoShows);
public record StaffAvailabilityDto(Guid StaffId, string StaffName, List<TimeSlotDto> AvailableSlots);
public record TimeSlotDto(DateTime StartsAt, DateTime EndsAt);

// ── Clients ───────────────────────────────────────────────────────────────────

public record CreateClientRequest(string FirstName, string LastName, string? Email, string? Phone, DateTime? DateOfBirth);
public record UpdateClientRequest(string? FirstName, string? LastName, string? Email, string? Phone, DateTime? DateOfBirth, List<ClientTag>? Tags, int? RebookIntervalDays);
public record AddNoteRequest(string Content, bool IsPinned = false);
public record UpdateNoteRequest(string? Content, bool? IsPinned);
public record SendMessageRequest(string Body, MessageChannel Channel);

public record ClientDto(Guid Id, string FirstName, string LastName, string? Email, string? Phone, string? AvatarUrl, List<ClientTag> Tags, ChurnRisk ChurnRisk, decimal LifetimeValue, int VisitCount, DateTime? LastVisitAt, DateTime CreatedAt);
public record ClientNoteDto(Guid Id, string Content, bool IsPinned, string AuthorUserId, DateTime CreatedAt, DateTime UpdatedAt);
public record ClientDocumentDto(Guid Id, string FileName, string Url, MediaType Type, DateTime CreatedAt);
public record ClientAiInsightDto(ChurnRisk ChurnRisk, decimal PredictedLtv, List<string> UpsellOpportunities, string? WinbackMessage, DateTime UpdatedAt);
public record PagedResult<T>(List<T> Items, int Total, int Page, int Limit);

// ── Bookings ──────────────────────────────────────────────────────────────────

public record CreateBookingRequest(Guid ClientId, Guid ServiceId, Guid StaffMemberId, DateTime StartsAt, string? Notes);
public record UpdateBookingRequest(DateTime? StartsAt, Guid? StaffMemberId, string? Notes);
public record AddToWaitlistRequest(Guid ClientId, Guid ServiceId, Guid? PreferredStaffId, DateTime PreferredDateStart, DateTime PreferredDateEnd);

public record BookingDto(Guid Id, Guid ClientId, string ClientName, Guid ServiceId, string ServiceName, Guid StaffMemberId, string StaffName, DateTime StartsAt, DateTime EndsAt, BookingStatus Status, decimal Price, string? Notes, DateTime CreatedAt);
public record AvailableSlotsRequest(Guid ServiceId, Guid? StaffMemberId, DateTime Date);
public record WaitlistEntryDto(Guid Id, Guid ClientId, string ClientName, Guid ServiceId, DateTime PreferredDateStart, DateTime PreferredDateEnd, DateTime CreatedAt);

// ── Public Booking ────────────────────────────────────────────────────────────

public record PublicBookingPageDto(Guid BusinessId, string Name, string? City, string? LogoUrl, string? CoverPhotoUrl, string? Theme, string? Currency);
public record ReserveSlotRequest(Guid ServiceId, Guid StaffMemberId, DateTime StartsAt, string ClientFirstName, string ClientLastName, string ClientEmail, string? ClientPhone);
public record ReserveSlotResponse(string LockToken, DateTime LockedUntil, decimal DepositAmount, bool DepositRequired);
public record ConfirmBookingRequest(string LockToken, string? StripePaymentMethodId, string? StripePaymentIntentId);
public record PublicReviewDto(string AuthorName, int Rating, string? Comment, DateTime CreatedAt);

// ── Payments ──────────────────────────────────────────────────────────────────

public record SavePaymentMethodRequest(string StripePaymentMethodId, bool IsDefault = false);
public record ChargeRequest(Guid BookingId, Guid ClientId, string StripePaymentMethodId, decimal Amount, decimal TipAmount = 0);
public record TapToPaySessionRequest(Guid BookingId, decimal Amount);
public record GeneratePaymentLinkRequest(Guid BookingId, decimal Amount, string? Note);
public record RecordCashPaymentRequest(Guid BookingId, decimal Amount, decimal TipAmount = 0);
public record ChargeDepositRequest(Guid BookingId, string StripePaymentMethodId);
public record AddTipRequest(Guid BookingId, decimal TipAmount);
public record RefundRequest(decimal? Amount);
public record ConnectBankAccountRequest(string StripeBankToken);

public record PaymentMethodDto(Guid Id, string Brand, string Last4, int ExpMonth, int ExpYear, bool IsDefault);
public record PaymentDto(Guid Id, Guid BookingId, decimal Amount, decimal TipAmount, decimal PlatformFee, decimal NetAmount, PaymentStatus Status, PaymentMethod Method, DateTime CreatedAt);
public record SetupIntentResponse(string ClientSecret);
public record TapToPaySessionResponse(string ClientSecret, string ReaderId);
public record PaymentLinkResponse(string Token, string Url);
public record PayoutDto(Guid Id, string StripePayoutId, decimal Amount, string Currency, string Status, DateTime? ArrivalDate, DateTime CreatedAt);
public record PendingBalanceDto(decimal Amount, string Currency, int PendingCount);

// ── AutoPilot ─────────────────────────────────────────────────────────────────

public record UpdateAutoPilotGlobalRequest(bool GloballyEnabled);
public record UpdateFlowRequest(bool IsEnabled, string? CustomSettings);

public record AutoPilotStatusDto(bool GloballyEnabled, List<FlowStatusDto> Flows);
public record FlowStatusDto(AutoPilotFlowId FlowId, string Name, string Description, bool IsEnabled, string Trigger, string Action);
public record AutoPilotEventDto(Guid Id, AutoPilotFlowId FlowId, string FlowName, Guid? ClientId, string? ClientName, string? Description, bool WasSuccessful, decimal? RevenueRecovered, DateTime CreatedAt);
public record AutoPilotStatsDto(int SlotsFilled, int MessagesSent, int WinbacksTriggered, int ReviewsRequested, int NoShowsRecovered, decimal TotalRevenueRecovered);

// ── AI ────────────────────────────────────────────────────────────────────────

public record UpdateAiPromptRequest(string Prompt);
public record ManualReplyRequest(string Message);
public record GenerateWinbackRequest(Guid ClientId, string? ClientName = null, string? LastService = null, int? DaysSince = null, decimal? Ltv = null);
public record SendWinbackRequest(Guid ClientId, string Message);

public record AiConversationDto(Guid Id, Guid? ClientId, string? ClientName, MessageChannel Channel, AiConversationStatus Status, int MessageCount, DateTime LastMessageAt);
public record AiConversationDetailDto(Guid Id, Guid? ClientId, string? ClientName, MessageChannel Channel, AiConversationStatus Status, List<AiMessageDto> Messages, DateTime CreatedAt);
public record AiMessageDto(Guid Id, bool IsFromClient, bool IsAiGenerated, string Content, DateTime CreatedAt);
public record AiInsightsDto(List<string> UnderbookedSlots, List<string> OverdueClients, List<string> UpsellOpportunities, List<string> ChurnRisks, List<string> PricingOpportunities, List<string> ScheduleOptimizations);
public record DailyBriefDto(DateTime Date, int AppointmentsToday, decimal RevenueTodayProjected, List<BookingDto> UpcomingBookings, List<string> AutoPilotHighlights, List<string> Alerts);
public record WinbackDraftDto(Guid ClientId, string ClientName, string MessageDraft);

// ── Notifications ─────────────────────────────────────────────────────────────

public record RegisterDeviceRequest(string Token, string Platform);
public record NotificationDto(Guid Id, NotificationType Type, string Title, string Body, bool IsRead, DateTime CreatedAt);

// ── Messaging ─────────────────────────────────────────────────────────────────

public record SendSmsRequest(Guid ClientId, string Message);
public record SendSmsDirectRequest(string To, string Body);
public record Register10DlcRequest(string LegalName, string Ein, string? Phone, string? Street, string? City, string? State, string? PostalCode);
public record SendEmailRequest(Guid ClientId, string Subject, string Body);
public record BlastRequest(string Message, List<ClientTag>? Tags, ChurnRisk? ChurnRisk);
public record CreateTemplateRequest(string Name, string Subject, string Body, MessageChannel Channel);
public record UpdateTemplateRequest(string? Name, string? Subject, string? Body, bool? IsActive);
public record UpdateBriefSettingsRequest(TimeOnly? DeliveryTime, List<MessageChannel>? Channels, bool? IsEnabled);

public record MessageTemplateDto(Guid Id, string Name, string Subject, string Body, MessageChannel Channel, bool IsActive, DateTime CreatedAt);
public record BriefSettingsDto(TimeOnly DeliveryTime, List<MessageChannel> Channels, bool IsEnabled);

// ── Channels ──────────────────────────────────────────────────────────────────

public record ConnectChannelRequest(string Code, string? RedirectUri);
public record ChannelDto(Guid Id, ChannelType Type, ChannelStatus Status, string? ExternalAccountName, DateTime? ConnectedAt);

// ── Operations ────────────────────────────────────────────────────────────────

public record OperationsScoreDto(int Score, int UtilizationScore, int RetentionScore, int RevenueScore, int AutoPilotScore);
public record UtilizationDto(decimal OverallUtilization, List<StaffUtilizationDto> ByStaff);
public record StaffUtilizationDto(Guid StaffId, string StaffName, decimal Utilization, int AppointmentsBooked, int TotalSlots);
public record RetentionDto(decimal RebookRate, decimal ChurnRate, int ActiveClients, int LostClients, int WonBackClients);
public record RevenueDto(decimal TotalRevenue, decimal AutoPilotRevenue, decimal AutoPilotPercent, List<RevenuePeriodDto> Trend);
public record RevenuePeriodDto(string Label, decimal Revenue);
public record MissedRevenueDto(decimal UnfilledSlotsValue, decimal MissedUpsellValue, int UnfilledSlotCount);

// ── Reports ───────────────────────────────────────────────────────────────────

public record ReportQueryParams(DateTime? From, DateTime? To, string? Period);

// ── Calendar ──────────────────────────────────────────────────────────────────

public record CalendarBookingDto(Guid Id, string ClientName, string ServiceName, string StaffName, DateTime StartsAt, DateTime EndsAt, BookingStatus Status, string? Colour);
public record WeekViewDto(DateTime WeekStart, List<DayRevenueDto> Days, decimal WeekTotal);
public record DayRevenueDto(DateTime Date, decimal Revenue, int BookingCount);
public record ConflictDto(Guid Booking1Id, Guid Booking2Id, string Description);

// ── Settings ──────────────────────────────────────────────────────────────────

public record UpdateBookingSettingsRequest(int? MinAdvanceNoticeHours, int? MaxAdvanceDays, bool? AllowPublicBooking, bool? RequireDeposit);
public record UpdateDepositSettingsRequest(decimal DefaultDepositPct);
public record UpdateNotificationSettingsRequest(bool? BookingConfirmations, bool? BookingReminders, bool? PaymentReceipts, bool? AutoPilotAlerts);
public record UpgradePlanRequest(SubscriptionPlan Plan);

public record BusinessSettingsDto(BusinessDto Business, BookingSettingsDto Booking, DepositSettingsDto Deposit, NotificationSettingsDto Notifications);
public record BookingSettingsDto(int MinAdvanceNoticeHours, int MaxAdvanceDays, bool AllowPublicBooking, bool RequireDeposit);
public record DepositSettingsDto(decimal DefaultDepositPct);
public record NotificationSettingsDto(bool BookingConfirmations, bool BookingReminders, bool PaymentReceipts, bool AutoPilotAlerts);
public record SubscriptionDto(SubscriptionPlan Plan, bool IsTrialing, DateTime? TrialEndsAt, DateTime? CurrentPeriodEnd, bool IsActive);
