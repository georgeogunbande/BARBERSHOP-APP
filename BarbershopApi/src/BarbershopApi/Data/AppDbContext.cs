using BarbershopApi.Models.AI;
using BarbershopApi.Models.AutoPilot;
using BarbershopApi.Models.Bookings;
using BarbershopApi.Models.Business;
using BarbershopApi.Models.Channels;
using BarbershopApi.Models.Clients;
using BarbershopApi.Models.Messaging;
using BarbershopApi.Models.Payments;
using BarbershopApi.Models.Services;
using BarbershopApi.Models.Staff;
using Microsoft.EntityFrameworkCore;

namespace BarbershopApi.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Business> Businesses => Set<Business>();
    public DbSet<BusinessHours> BusinessHours => Set<BusinessHours>();
    public DbSet<FamilyHoursConfig> FamilyHoursConfigs => Set<FamilyHoursConfig>();
    public DbSet<BusinessMedia> BusinessMedia => Set<BusinessMedia>();
    public DbSet<Subscription> Subscriptions => Set<Subscription>();

    public DbSet<StaffMember> StaffMembers => Set<StaffMember>();
    public DbSet<StaffSchedule> StaffSchedules => Set<StaffSchedule>();

    public DbSet<ServiceCategory> ServiceCategories => Set<ServiceCategory>();
    public DbSet<Service> Services => Set<Service>();

    public DbSet<Client> Clients => Set<Client>();
    public DbSet<ClientNote> ClientNotes => Set<ClientNote>();
    public DbSet<ClientDocument> ClientDocuments => Set<ClientDocument>();

    public DbSet<Booking> Bookings => Set<Booking>();
    public DbSet<WaitlistEntry> WaitlistEntries => Set<WaitlistEntry>();

    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<SavedPaymentMethod> SavedPaymentMethods => Set<SavedPaymentMethod>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<Payout> Payouts => Set<Payout>();

    public DbSet<AutoPilotFlowConfig> AutoPilotFlowConfigs => Set<AutoPilotFlowConfig>();
    public DbSet<AutoPilotEvent> AutoPilotEvents => Set<AutoPilotEvent>();

    public DbSet<AiConversation> AiConversations => Set<AiConversation>();
    public DbSet<AiConversationMessage> AiConversationMessages => Set<AiConversationMessage>();

    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<DeviceToken> DeviceTokens => Set<DeviceToken>();
    public DbSet<MessageTemplate> MessageTemplates => Set<MessageTemplate>();
    public DbSet<MessagingLog> MessagingLogs => Set<MessagingLog>();
    public DbSet<BriefSettings> BriefSettings => Set<BriefSettings>();

    public DbSet<Channel> Channels => Set<Channel>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Business>(e =>
        {
            e.HasKey(b => b.Id);
            e.HasIndex(b => b.BookingHandle).IsUnique().HasFilter("[BookingHandle] IS NOT NULL");
            e.Property(b => b.Name).HasMaxLength(200).IsRequired();
            e.Property(b => b.Currency).HasMaxLength(3);
            e.HasOne(b => b.FamilyHours).WithOne(f => f.Business).HasForeignKey<FamilyHoursConfig>(f => f.BusinessId);
            e.HasOne(b => b.Subscription).WithOne(s => s.Business).HasForeignKey<Subscription>(s => s.BusinessId);
        });

        modelBuilder.Entity<BusinessHours>(e =>
        {
            e.HasKey(h => h.Id);
            e.HasOne(h => h.Business).WithMany(b => b.Hours).HasForeignKey(h => h.BusinessId);
        });

        modelBuilder.Entity<StaffMember>(e =>
        {
            e.HasKey(s => s.Id);
            e.HasIndex(s => new { s.BusinessId, s.UserId }).IsUnique();
            e.Property(s => s.ServiceIds).HasConversion(
                v => string.Join(',', v),
                v => v.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(Guid.Parse).ToList());
        });

        modelBuilder.Entity<StaffSchedule>(e =>
        {
            e.HasKey(s => s.Id);
            e.HasOne(s => s.StaffMember).WithMany(m => m.Schedules).HasForeignKey(s => s.StaffMemberId);
        });

        modelBuilder.Entity<Service>(e =>
        {
            e.HasKey(s => s.Id);
            e.Property(s => s.Price).HasColumnType("decimal(18,2)");
            e.Property(s => s.DepositPct).HasColumnType("decimal(5,2)");
            e.HasOne(s => s.Category).WithMany(c => c.Services).HasForeignKey(s => s.CategoryId).IsRequired(false);
            e.HasQueryFilter(s => !s.IsDeleted);
        });

        modelBuilder.Entity<Client>(e =>
        {
            e.HasKey(c => c.Id);
            e.Property(c => c.LifetimeValue).HasColumnType("decimal(18,2)");
            e.HasIndex(c => new { c.BusinessId, c.Email });
            e.HasIndex(c => new { c.BusinessId, c.Phone });
            e.Property(c => c.Tags).HasConversion(
                v => string.Join(',', v.Select(t => (int)t)),
                v => v == "" ? new List<Models.Enums.ClientTag>() : v.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(x => (Models.Enums.ClientTag)int.Parse(x)).ToList());
            e.HasQueryFilter(c => !c.IsArchived);
        });

        modelBuilder.Entity<ClientNote>(e =>
        {
            e.HasKey(n => n.Id);
            e.HasOne(n => n.Client).WithMany(c => c.Notes).HasForeignKey(n => n.ClientId);
        });

        modelBuilder.Entity<ClientDocument>(e =>
        {
            e.HasKey(d => d.Id);
            e.HasOne(d => d.Client).WithMany(c => c.Documents).HasForeignKey(d => d.ClientId);
        });

        modelBuilder.Entity<Booking>(e =>
        {
            e.HasKey(b => b.Id);
            e.Property(b => b.Price).HasColumnType("decimal(18,2)");
            e.Property(b => b.DepositAmount).HasColumnType("decimal(18,2)");
            e.HasIndex(b => new { b.BusinessId, b.StartsAt });
            e.HasIndex(b => new { b.BusinessId, b.ClientId });
            e.HasIndex(b => new { b.BusinessId, b.StaffMemberId });
        });

        modelBuilder.Entity<Payment>(e =>
        {
            e.HasKey(p => p.Id);
            e.Property(p => p.Amount).HasColumnType("decimal(18,2)");
            e.Property(p => p.TipAmount).HasColumnType("decimal(18,2)");
            e.Property(p => p.PlatformFee).HasColumnType("decimal(18,2)");
            e.Property(p => p.NetAmount).HasColumnType("decimal(18,2)");
            e.Property(p => p.RefundedAmount).HasColumnType("decimal(18,2)");
        });

        modelBuilder.Entity<AuditLog>(e =>
        {
            e.HasKey(a => a.Id);
            e.ToTable(tb => tb.HasCheckConstraint("CK_AuditLog_Immutable", "1=1"));
        });

        modelBuilder.Entity<AiConversation>(e =>
        {
            e.HasKey(c => c.Id);
            e.HasMany(c => c.Messages).WithOne(m => m.Conversation).HasForeignKey(m => m.ConversationId);
        });

        modelBuilder.Entity<FamilyHoursConfig>(e =>
        {
            e.HasKey(f => f.Id);
            e.Property(f => f.Days).HasConversion(
                v => string.Join(',', v.Select(d => (int)d)),
                v => v == "" ? new List<DayOfWeek>() : v.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(x => (DayOfWeek)int.Parse(x)).ToList());
        });

        modelBuilder.Entity<BriefSettings>(e =>
        {
            e.HasKey(b => b.Id);
            e.HasIndex(b => b.BusinessId).IsUnique();
            e.Property(b => b.Channels).HasConversion(
                v => string.Join(',', v.Select(c => (int)c)),
                v => v == "" ? new List<Models.Enums.MessageChannel>() : v.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(x => (Models.Enums.MessageChannel)int.Parse(x)).ToList());
        });
    }
}
