using BarbershopApi.Data;
using BarbershopApi.Models.AutoPilot;
using BarbershopApi.Models.Enums;
using Microsoft.EntityFrameworkCore;

namespace BarbershopApi.Services;

public interface IAutoPilotService
{
    Task<bool> IsFlowEnabledAsync(Guid businessId, AutoPilotFlowId flowId);
    Task TriggerCancellationAlertAsync(Guid businessId, Guid bookingId, Guid clientId);
    Task TriggerReviewRequestAsync(Guid businessId, Guid bookingId, Guid clientId);
    Task TriggerWinbackAsync(Guid businessId, Guid clientId);
}

public class AutoPilotService(
    AppDbContext db,
    AuthDbContext authDb,
    ISmsService sms,
    IEmailService email,
    IServiceScopeFactory scopeFactory,
    ILogger<AutoPilotService> logger) : IAutoPilotService
{
    public async Task<bool> IsFlowEnabledAsync(Guid businessId, AutoPilotFlowId flowId)
    {
        var cfg = await db.AutoPilotFlowConfigs
            .FirstOrDefaultAsync(c => c.BusinessId == businessId && c.FlowId == flowId);
        return cfg?.IsEnabled ?? true;
    }

    public async Task TriggerCancellationAlertAsync(Guid businessId, Guid bookingId, Guid clientId)
    {
        if (!await IsFlowEnabledAsync(businessId, AutoPilotFlowId.CancellationAlert)) return;

        var client = await db.Clients.FindAsync(clientId);
        var booking = await db.Bookings.FindAsync(bookingId);
        var owner = await authDb.Users
            .FirstOrDefaultAsync(u => u.BusinessId == businessId && u.Role == StaffRole.Owner);

        var clientName = client?.FullName ?? "A client";
        var time = booking?.StartsAt.ToString("ddd MMM d 'at' h:mmtt") ?? "their appointment";

        if (!string.IsNullOrEmpty(owner?.PhoneNumber))
            await sms.SendAsync(owner.PhoneNumber, $"[FlatPurse] {clientName} cancelled {time}.");
        else if (!string.IsNullOrEmpty(owner?.Email))
            await email.SendAsync(owner.Email, $"{owner.FirstName} {owner.LastName}",
                "Appointment Cancelled",
                $"<p><strong>{clientName}</strong> cancelled their appointment for <strong>{time}</strong>.</p>");

        await LogEventAsync(businessId, AutoPilotFlowId.CancellationAlert, clientId,
            $"Cancellation alert sent to owner for {clientName}");

        await TriggerSlotFillerAsync(businessId, booking?.ServiceId);
    }

    public async Task TriggerReviewRequestAsync(Guid businessId, Guid bookingId, Guid clientId)
    {
        if (!await IsFlowEnabledAsync(businessId, AutoPilotFlowId.ReviewRequest)) return;

        // Fire-and-forget after 24 hours; app-restart will lose pending sends (acceptable MVP tradeoff)
        _ = Task.Run(async () =>
        {
            await Task.Delay(TimeSpan.FromHours(24));
            try
            {
                using var scope = scopeFactory.CreateScope();
                var scopedDb = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var scopedSms = scope.ServiceProvider.GetRequiredService<ISmsService>();
                var scopedEmail = scope.ServiceProvider.GetRequiredService<IEmailService>();

                var client = await scopedDb.Clients.FindAsync(clientId);
                if (client == null) return;

                var sent = false;
                if (!string.IsNullOrEmpty(client.Phone))
                {
                    var (_, _, err) = await scopedSms.SendAsync(client.Phone,
                        $"Hi {client.FirstName}! Thanks for visiting us today. Got 30 seconds? We'd love a review — it really helps the shop grow 🙏");
                    sent = err == null;
                }
                else if (!string.IsNullOrEmpty(client.Email))
                {
                    sent = await scopedEmail.SendAsync(client.Email, client.FullName,
                        "How was your visit?",
                        $"<p>Hi {client.FirstName},</p><p>Thanks for coming in! We'd love to hear how it went. A quick review goes a long way for a small business like ours.</p>");
                }

                scopedDb.AutoPilotEvents.Add(new AutoPilotEvent
                {
                    BusinessId = businessId,
                    FlowId = AutoPilotFlowId.ReviewRequest,
                    ClientId = clientId,
                    Description = $"Review request sent to {client.FullName}",
                    WasSuccessful = sent
                });
                await scopedDb.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Review request background task failed for client {ClientId}", clientId);
            }
        });
    }

    public async Task TriggerWinbackAsync(Guid businessId, Guid clientId)
    {
        if (!await IsFlowEnabledAsync(businessId, AutoPilotFlowId.Winback)) return;

        var client = await db.Clients.FindAsync(clientId);
        if (client == null) return;

        var sent = false;
        if (!string.IsNullOrEmpty(client.Phone))
        {
            var (_, _, err) = await sms.SendAsync(client.Phone,
                $"Hey {client.FirstName}! We miss you at the shop. Book your next visit — priority slots available: https://book.flatpurse.com");
            sent = err == null;
        }
        else if (!string.IsNullOrEmpty(client.Email))
        {
            sent = await email.SendAsync(client.Email, client.FullName,
                "We miss you!",
                $"<p>Hey {client.FirstName}!</p><p>It's been a while and we'd love to have you back. Book now and get priority scheduling.</p><p><a href='https://book.flatpurse.com'>Book Now</a></p>");
        }

        await LogEventAsync(businessId, AutoPilotFlowId.Winback, clientId,
            $"Win-back message sent to {client.FullName}", sent);
    }

    private async Task TriggerSlotFillerAsync(Guid businessId, Guid? serviceId)
    {
        if (!await IsFlowEnabledAsync(businessId, AutoPilotFlowId.SlotFiller)) return;

        var waitlist = await db.WaitlistEntries
            .Where(w => w.BusinessId == businessId && (!serviceId.HasValue || w.ServiceId == serviceId))
            .Take(5)
            .ToListAsync();

        if (waitlist.Count == 0) return;

        var clientIds = waitlist.Select(w => w.ClientId).ToList();
        var clients = await db.Clients.Where(c => clientIds.Contains(c.Id)).ToDictionaryAsync(c => c.Id);

        foreach (var entry in waitlist)
        {
            if (!clients.TryGetValue(entry.ClientId, out var client) || string.IsNullOrEmpty(client.Phone))
                continue;
            await sms.SendAsync(client.Phone,
                $"Hi {client.FirstName}! A slot just opened up — grab it before it's gone: https://book.flatpurse.com");
        }

        await LogEventAsync(businessId, AutoPilotFlowId.SlotFiller, null,
            $"Slot filler SMS sent to {waitlist.Count} waitlist client(s)");
    }

    private async Task LogEventAsync(Guid businessId, AutoPilotFlowId flowId, Guid? clientId,
        string description, bool success = true)
    {
        db.AutoPilotEvents.Add(new AutoPilotEvent
        {
            BusinessId = businessId,
            FlowId = flowId,
            ClientId = clientId,
            Description = description,
            WasSuccessful = success
        });
        await db.SaveChangesAsync();
    }
}
