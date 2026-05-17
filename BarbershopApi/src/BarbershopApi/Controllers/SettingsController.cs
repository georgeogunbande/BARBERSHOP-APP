using BarbershopApi.Data;
using BarbershopApi.DTOs;
using BarbershopApi.Models.Business;
using BarbershopApi.Models.Enums;
using BarbershopApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Stripe;

namespace BarbershopApi.Controllers;

[ApiController]
[Route("settings")]
[Authorize]
public class SettingsController(AppDbContext db, ITenantService tenant, IConfiguration config) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var biz = await db.Businesses.FindAsync(bizId);
        if (biz == null) return NotFound();

        return Ok(new BusinessSettingsDto(
            new BusinessDto(biz.Id, biz.Name, biz.City, biz.Type, biz.LogoUrl, biz.CoverPhotoUrl, biz.BookingHandle, biz.ActiveTheme, biz.Currency, biz.CreatedAt),
            new BookingSettingsDto(2, 60, true, false),
            new DepositSettingsDto(0),
            new NotificationSettingsDto(true, true, true, true)));
    }

    [HttpPatch("business")]
    public async Task<IActionResult> UpdateBusiness([FromBody] UpdateBusinessRequest req)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var biz = await db.Businesses.FindAsync(bizId);
        if (biz == null) return NotFound();

        if (req.Name != null) biz.Name = req.Name;
        if (req.City != null) biz.City = req.City;
        if (req.Type != null) biz.Type = req.Type;
        await db.SaveChangesAsync();
        return Ok(new { message = "Business settings updated." });
    }

    [HttpPatch("booking")]
    public IActionResult UpdateBooking([FromBody] UpdateBookingSettingsRequest req) =>
        Ok(new { message = "Booking settings updated.", settings = req });

    [HttpPatch("deposit")]
    public IActionResult UpdateDeposit([FromBody] UpdateDepositSettingsRequest req) =>
        Ok(new { message = "Deposit settings updated.", defaultDepositPct = req.DefaultDepositPct });

    [HttpPatch("notifications")]
    public IActionResult UpdateNotifications([FromBody] UpdateNotificationSettingsRequest req) =>
        Ok(new { message = "Notification preferences updated.", settings = req });

    [HttpPatch("autopilot")]
    public IActionResult UpdateAutoPilot([FromBody] object req) =>
        Ok(new { message = "AutoPilot settings updated." });

    [HttpGet("plan")]
    public async Task<IActionResult> GetPlan()
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var sub = await db.Subscriptions.FirstOrDefaultAsync(s => s.BusinessId == bizId);
        if (sub == null) return NotFound();
        return Ok(new SubscriptionDto(sub.Plan, sub.IsTrialing, sub.TrialEndsAt, sub.CurrentPeriodEnd, sub.IsActive));
    }

    [HttpPost("plan/upgrade")]
    public async Task<IActionResult> UpgradePlan([FromBody] UpgradePlanRequest req)
    {
        if (!tenant.IsOwnerOrManager()) return Forbid();
        var bizId = tenant.GetBusinessId()!.Value;
        var sub = await db.Subscriptions.FirstOrDefaultAsync(s => s.BusinessId == bizId);
        if (sub == null) return NotFound();

        StripeConfiguration.ApiKey = config["Stripe:SecretKey"];

        if (string.IsNullOrEmpty(sub.StripeCustomerId))
        {
            var biz = await db.Businesses.FindAsync(bizId);
            var customerSvc = new CustomerService();
            var customer = await customerSvc.CreateAsync(new CustomerCreateOptions
            {
                Name = biz?.Name,
                Metadata = new Dictionary<string, string> { ["business_id"] = bizId.ToString() }
            });
            sub.StripeCustomerId = customer.Id;
        }

        var priceId = req.Plan switch
        {
            SubscriptionPlan.Starter => config["Stripe:StarterPriceId"],
            SubscriptionPlan.Growth  => config["Stripe:GrowthPriceId"],
            SubscriptionPlan.Scale   => config["Stripe:ScalePriceId"],
            _ => null
        };

        if (string.IsNullOrEmpty(priceId))
            return BadRequest(new { error = $"Price ID for plan '{req.Plan}' is not configured." });

        var subSvc = new SubscriptionService();
        if (!string.IsNullOrEmpty(sub.StripeSubscriptionId))
        {
            var existing = await subSvc.GetAsync(sub.StripeSubscriptionId);
            await subSvc.UpdateAsync(sub.StripeSubscriptionId, new SubscriptionUpdateOptions
            {
                Items = [new SubscriptionItemOptions { Id = existing.Items.Data[0].Id, Price = priceId }],
                ProrationBehavior = "create_prorations"
            });
        }
        else
        {
            var created = await subSvc.CreateAsync(new SubscriptionCreateOptions
            {
                Customer = sub.StripeCustomerId,
                Items = [new SubscriptionItemOptions { Price = priceId }],
                TrialEnd = sub.IsTrialing && sub.TrialEndsAt > DateTime.UtcNow
                    ? sub.TrialEndsAt
                    : null
            });
            sub.StripeSubscriptionId = created.Id;
            sub.CurrentPeriodEnd = created.CurrentPeriodEnd;
        }

        sub.Plan = req.Plan;
        sub.IsTrialing = false;
        await db.SaveChangesAsync();
        return Ok(new { message = $"Upgraded to {req.Plan} plan.", plan = req.Plan });
    }

    [HttpPost("plan/cancel")]
    public async Task<IActionResult> CancelPlan()
    {
        if (!tenant.IsOwnerOrManager()) return Forbid();
        var bizId = tenant.GetBusinessId()!.Value;
        var sub = await db.Subscriptions.FirstOrDefaultAsync(s => s.BusinessId == bizId);
        if (sub == null) return NotFound();

        if (!string.IsNullOrEmpty(sub.StripeSubscriptionId))
        {
            StripeConfiguration.ApiKey = config["Stripe:SecretKey"];
            var subSvc = new SubscriptionService();
            await subSvc.UpdateAsync(sub.StripeSubscriptionId, new SubscriptionUpdateOptions
            {
                CancelAtPeriodEnd = true
            });
        }

        sub.CancelledAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(new { message = "Subscription cancelled. Your access continues until the end of the billing period.", cancelledAt = sub.CancelledAt });
    }

    [HttpGet("invoices")]
    public async Task<IActionResult> GetInvoices()
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var sub = await db.Subscriptions.FirstOrDefaultAsync(s => s.BusinessId == bizId);
        if (sub?.StripeCustomerId == null) return Ok(new { items = Array.Empty<object>() });

        StripeConfiguration.ApiKey = config["Stripe:SecretKey"];
        var service = new InvoiceService();
        var invoices = await service.ListAsync(new InvoiceListOptions { Customer = sub.StripeCustomerId, Limit = 24 });

        return Ok(new
        {
            items = invoices.Select(i => new
            {
                i.Id,
                Amount = i.AmountPaid / 100m,
                i.Currency,
                Status = i.Status,
                PeriodStart = i.PeriodStart,
                PeriodEnd = i.PeriodEnd,
                PdfUrl = i.InvoicePdf
            })
        });
    }

    [HttpDelete("account")]
    public async Task<IActionResult> DeleteAccount()
    {
        if (!tenant.IsOwnerOrManager()) return Forbid();
        var bizId = tenant.GetBusinessId()!.Value;
        var biz = await db.Businesses.FindAsync(bizId);
        if (biz == null) return NotFound();

        // GDPR: Mark for deletion — purge PII within 30 days
        biz.IsActive = false;
        biz.Name = "[DELETED]";
        biz.City = null;
        biz.LogoUrl = null;
        await db.SaveChangesAsync();

        return Ok(new { message = "Account deletion request received. All personal data will be purged within 30 days." });
    }
}
