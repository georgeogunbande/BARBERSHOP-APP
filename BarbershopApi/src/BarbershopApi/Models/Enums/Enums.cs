namespace BarbershopApi.Models.Enums;

public enum StaffRole { Owner, Manager, Stylist, Receptionist }

public enum BookingStatus { Pending, Confirmed, InProgress, Completed, Cancelled, NoShow }

public enum PaymentStatus { Pending, Succeeded, Failed, Refunded, PartialRefund }

public enum PaymentMethod { Card, Cash, TapToPay, PaymentLink, Interac }

public enum DepositStatus { None, PendingInterac, Confirmed }

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

public enum ReportType { Revenue, Clients, Staff, Services, AutoPilot, Tax }

public enum ExportFormat { CSV, PDF }

public enum MediaType { Logo, Cover, ClientDocument, ConsentForm }
