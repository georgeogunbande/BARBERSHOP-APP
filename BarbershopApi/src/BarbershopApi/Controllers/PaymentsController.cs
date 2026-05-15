using BarbershopApi.Data;
using BarbershopApi.DTOs;
using BarbershopApi.Models.Enums;
using BarbershopApi.Models.Payments;
using BarbershopApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Stripe;

namespace BarbershopApi.Controllers;

[ApiController]
[Route("payments")]
[Authorize]
public class PaymentsController(AppDbContext db, ITenantService tenant, IConfiguration config, IAuditService audit) : ControllerBase
{
    [HttpGet("methods")]
    public async Task<IActionResult> GetMethods([FromQuery] Guid clientId)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var methods = await db.SavedPaymentMethods.Where(m => m.BusinessId == bizId && m.ClientId == clientId).ToListAsync();
        return Ok(methods.Select(m => new PaymentMethodDto(m.Id, m.Brand, m.Last4, m.ExpMonth, m.ExpYear, m.IsDefault)));
    }

    [HttpPost("methods")]
    public async Task<IActionResult> SaveMethod([FromQuery] Guid clientId, [FromBody] SavePaymentMethodRequest req)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        StripeConfiguration.ApiKey = config["Stripe:SecretKey"];
        var pmService = new PaymentMethodService();
        var pm = await pmService.GetAsync(req.StripePaymentMethodId);

        if (req.IsDefault)
        {
            var existing = await db.SavedPaymentMethods.Where(m => m.BusinessId == bizId && m.ClientId == clientId).ToListAsync();
            existing.ForEach(m => m.IsDefault = false);
        }

        var saved = new SavedPaymentMethod
        {
            BusinessId = bizId,
            ClientId = clientId,
            StripePaymentMethodId = req.StripePaymentMethodId,
            Brand = pm.Card?.Brand ?? "unknown",
            Last4 = pm.Card?.Last4 ?? "0000",
            ExpMonth = (int)(pm.Card?.ExpMonth ?? 0),
            ExpYear = (int)(pm.Card?.ExpYear ?? 0),
            IsDefault = req.IsDefault
        };
        db.SavedPaymentMethods.Add(saved);
        await db.SaveChangesAsync();
        return Ok(new PaymentMethodDto(saved.Id, saved.Brand, saved.Last4, saved.ExpMonth, saved.ExpYear, saved.IsDefault));
    }

    [HttpDelete("methods/{id:guid}")]
    public async Task<IActionResult> DeleteMethod(Guid id)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var method = await db.SavedPaymentMethods.FirstOrDefaultAsync(m => m.Id == id && m.BusinessId == bizId);
        if (method == null) return NotFound();
        db.SavedPaymentMethods.Remove(method);
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("setup-intent")]
    public async Task<IActionResult> CreateSetupIntent([FromQuery] Guid clientId)
    {
        StripeConfiguration.ApiKey = config["Stripe:SecretKey"];
        var client = await db.Clients.FindAsync(clientId);
        if (client == null) return NotFound();

        var service = new SetupIntentService();
        var intent = await service.CreateAsync(new SetupIntentCreateOptions
        {
            Customer = client.StripeCustomerId,
            PaymentMethodTypes = ["card"]
        });
        return Ok(new SetupIntentResponse(intent.ClientSecret!));
    }

    [HttpPost("charge")]
    public async Task<IActionResult> Charge([FromBody] ChargeRequest req)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        StripeConfiguration.ApiKey = config["Stripe:SecretKey"];

        var platformFeePercent = GetPlatformFeePercent();
        var totalAmount = req.Amount + req.TipAmount;
        var platformFee = Math.Round(totalAmount * platformFeePercent, 2);

        var piService = new PaymentIntentService();
        var pi = await piService.CreateAsync(new PaymentIntentCreateOptions
        {
            Amount = (long)(totalAmount * 100),
            Currency = "cad",
            PaymentMethod = req.StripePaymentMethodId,
            Confirm = true,
            ApplicationFeeAmount = (long)(platformFee * 100),
            TransferData = new PaymentIntentTransferDataOptions { Destination = await GetStripeAccountAsync(bizId) }
        });

        var payment = new Payment
        {
            BusinessId = bizId,
            BookingId = req.BookingId,
            ClientId = req.ClientId,
            Amount = req.Amount,
            TipAmount = req.TipAmount,
            PlatformFee = platformFee,
            NetAmount = totalAmount - platformFee,
            Status = pi.Status == "succeeded" ? PaymentStatus.Succeeded : PaymentStatus.Failed,
            Method = Models.Enums.PaymentMethod.Card,
            StripePaymentIntentId = pi.Id
        };
        db.Payments.Add(payment);
        await db.SaveChangesAsync();

        await audit.LogAsync(bizId, tenant.GetUserId(), "CHARGE", "Payment", payment.Id.ToString(), $"${totalAmount} charged");
        return Ok(new PaymentDto(payment.Id, payment.BookingId, payment.Amount, payment.TipAmount, payment.PlatformFee, payment.NetAmount, payment.Status, payment.Method, payment.CreatedAt));
    }

    [HttpPost("tap-to-pay/session")]
    public async Task<IActionResult> TapToPaySession([FromBody] TapToPaySessionRequest req)
    {
        StripeConfiguration.ApiKey = config["Stripe:SecretKey"];
        var piService = new PaymentIntentService();
        var pi = await piService.CreateAsync(new PaymentIntentCreateOptions
        {
            Amount = (long)(req.Amount * 100),
            Currency = "cad",
            PaymentMethodTypes = ["card_present"],
            CaptureMethod = "manual"
        });
        return Ok(new TapToPaySessionResponse(pi.ClientSecret!, "simulated_reader"));
    }

    [HttpPost("tap-to-pay/confirm")]
    public IActionResult TapToPayConfirm() => Ok(new { message = "Tap to Pay confirmed." });

    [HttpPost("payment-link")]
    public async Task<IActionResult> GeneratePaymentLink([FromBody] GeneratePaymentLinkRequest req)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var token = Guid.NewGuid().ToString("N");
        var booking = await db.Bookings.FindAsync(req.BookingId);
        if (booking == null) return NotFound();

        booking.Notes = $"PAYMENT_LINK:{token}";
        await db.SaveChangesAsync();

        var url = $"https://pay.flatpurse.com/{token}";
        return Ok(new PaymentLinkResponse(token, url));
    }

    [HttpGet("payment-link/{token}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPaymentLink(string token)
    {
        var booking = await db.Bookings.FirstOrDefaultAsync(b => b.Notes != null && b.Notes.Contains($"PAYMENT_LINK:{token}"));
        if (booking == null) return NotFound();
        return Ok(new { booking, message = "Payment link is valid." });
    }

    [HttpPost("payment-link/{token}")]
    [AllowAnonymous]
    public IActionResult SubmitPaymentViaLink(string token) =>
        Ok(new { message = "Payment submitted via link.", token });

    [HttpPost("cash")]
    public async Task<IActionResult> RecordCash([FromBody] RecordCashPaymentRequest req)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var totalAmount = req.Amount + req.TipAmount;
        var platformFeePercent = GetPlatformFeePercent();
        var platformFee = Math.Round(totalAmount * platformFeePercent, 2);

        var payment = new Payment
        {
            BusinessId = bizId,
            BookingId = req.BookingId,
            ClientId = (await db.Bookings.FindAsync(req.BookingId))?.ClientId ?? Guid.Empty,
            Amount = req.Amount,
            TipAmount = req.TipAmount,
            PlatformFee = 0,
            NetAmount = totalAmount,
            Status = PaymentStatus.Succeeded,
            Method = Models.Enums.PaymentMethod.Cash
        };
        db.Payments.Add(payment);
        await db.SaveChangesAsync();
        await audit.LogAsync(bizId, tenant.GetUserId(), "CASH_PAYMENT", "Payment", payment.Id.ToString(), $"${totalAmount} cash");
        return Ok(new PaymentDto(payment.Id, payment.BookingId, payment.Amount, payment.TipAmount, payment.PlatformFee, payment.NetAmount, payment.Status, payment.Method, payment.CreatedAt));
    }

    [HttpPost("deposit")]
    public async Task<IActionResult> ChargeDeposit([FromBody] ChargeDepositRequest req)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var booking = await db.Bookings.FindAsync(req.BookingId);
        if (booking == null) return NotFound();
        // TODO: charge via Stripe
        booking.DepositPaid = true;
        await db.SaveChangesAsync();
        return Ok(new { message = "Deposit charged.", amount = booking.DepositAmount });
    }

    [HttpGet("deposit/{bookingId:guid}")]
    public async Task<IActionResult> GetDepositStatus(Guid bookingId)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var booking = await db.Bookings.FirstOrDefaultAsync(b => b.Id == bookingId && b.BusinessId == bizId);
        if (booking == null) return NotFound();
        return Ok(new { bookingId, depositAmount = booking.DepositAmount, depositPaid = booking.DepositPaid });
    }

    [HttpPost("tip")]
    public async Task<IActionResult> AddTip([FromBody] AddTipRequest req)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var payment = await db.Payments.FirstOrDefaultAsync(p => p.BusinessId == bizId && p.BookingId == req.BookingId);
        if (payment == null) return NotFound();

        payment.TipAmount += req.TipAmount;
        payment.NetAmount += req.TipAmount;
        await db.SaveChangesAsync();
        await audit.LogAsync(bizId, tenant.GetUserId(), "TIP_ADDED", "Payment", payment.Id.ToString(), $"${req.TipAmount} tip");
        return Ok(new { message = "Tip added.", totalTip = payment.TipAmount });
    }

    [HttpPatch("{id:guid}/refund")]
    public async Task<IActionResult> Refund(Guid id, [FromBody] RefundRequest req)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var payment = await db.Payments.FirstOrDefaultAsync(p => p.Id == id && p.BusinessId == bizId);
        if (payment == null) return NotFound();

        StripeConfiguration.ApiKey = config["Stripe:SecretKey"];
        var refundAmount = req.Amount ?? payment.Amount;

        if (!string.IsNullOrEmpty(payment.StripeChargeId))
        {
            var refundService = new RefundService();
            await refundService.CreateAsync(new RefundCreateOptions
            {
                Charge = payment.StripeChargeId,
                Amount = (long)(refundAmount * 100)
            });
        }

        payment.RefundedAmount = refundAmount;
        payment.RefundedAt = DateTime.UtcNow;
        payment.Status = refundAmount >= payment.Amount ? PaymentStatus.Refunded : PaymentStatus.PartialRefund;
        await db.SaveChangesAsync();
        await audit.LogAsync(bizId, tenant.GetUserId(), "REFUND", "Payment", id.ToString(), $"${refundAmount} refunded");
        return Ok(new { message = "Refund processed.", refundedAmount = refundAmount });
    }

    private decimal GetPlatformFeePercent()
    {
        return decimal.Parse(config["Stripe:PlatformFeePercent"] ?? "1.0") / 100;
    }

    private async Task<string?> GetStripeAccountAsync(Guid bizId)
    {
        var biz = await db.Businesses.FindAsync(bizId);
        return biz?.StripeAccountId;
    }
}

[ApiController]
[Route("payouts")]
[Authorize]
public class PayoutsController(AppDbContext db, ITenantService tenant, IConfiguration config) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int page = 1, [FromQuery] int limit = 20)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var query = db.Payouts.Where(p => p.BusinessId == bizId).OrderByDescending(p => p.CreatedAt);
        var total = await query.CountAsync();
        var payouts = await query.Skip((page - 1) * limit).Take(limit).ToListAsync();
        return Ok(new { items = payouts.Select(MapPayout), total, page, limit });
    }

    [HttpGet("pending")]
    public async Task<IActionResult> GetPending()
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var biz = await db.Businesses.FindAsync(bizId);
        if (string.IsNullOrEmpty(biz?.StripeAccountId)) return Ok(new PendingBalanceDto(0, "CAD", 0));

        StripeConfiguration.ApiKey = config["Stripe:SecretKey"];
        // TODO: fetch from Stripe Balance API
        return Ok(new PendingBalanceDto(0, "CAD", 0));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var payout = await db.Payouts.FirstOrDefaultAsync(p => p.Id == id && p.BusinessId == bizId);
        return payout == null ? NotFound() : Ok(MapPayout(payout));
    }

    [HttpPost("bank-account")]
    public async Task<IActionResult> ConnectBankAccount([FromBody] ConnectBankAccountRequest req)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        StripeConfiguration.ApiKey = config["Stripe:SecretKey"];
        // TODO: create/attach bank account via Stripe Connect
        var biz = await db.Businesses.FindAsync(bizId);
        if (biz != null) { biz.StripeBankAccountId = req.StripeBankToken; await db.SaveChangesAsync(); }
        return Ok(new { message = "Bank account connected." });
    }

    [HttpDelete("bank-account")]
    public async Task<IActionResult> RemoveBankAccount()
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var biz = await db.Businesses.FindAsync(bizId);
        if (biz != null) { biz.StripeBankAccountId = null; await db.SaveChangesAsync(); }
        return NoContent();
    }

    private static PayoutDto MapPayout(Payout p) => new(p.Id, p.StripePayoutId, p.Amount, p.Currency, p.Status, p.ArrivalDate, p.CreatedAt);
}
