using BarbershopApi.Data;
using BarbershopApi.Models.Enums;
using BarbershopApi.Models.Payments;
using Microsoft.AspNetCore.Mvc;
using Stripe;

namespace BarbershopApi.Controllers;

[ApiController]
[Route("webhooks")]
public class WebhooksController(AppDbContext db, IConfiguration config, ILogger<WebhooksController> logger) : ControllerBase
{
    [HttpPost("stripe")]
    public async Task<IActionResult> StripeWebhook()
    {
        var payload = await new StreamReader(Request.Body).ReadToEndAsync();
        var sigHeader = Request.Headers["Stripe-Signature"].FirstOrDefault();
        var webhookSecret = config["Stripe:WebhookSecret"];

        if (string.IsNullOrEmpty(sigHeader) || string.IsNullOrEmpty(webhookSecret))
            return BadRequest(new { error = "Missing Stripe-Signature header." });

        Event stripeEvent;
        try
        {
            stripeEvent = EventUtility.ConstructEvent(payload, sigHeader, webhookSecret);
        }
        catch (StripeException ex)
        {
            logger.LogWarning("Invalid Stripe signature: {Message}", ex.Message);
            return BadRequest(new { error = "Invalid Stripe signature." });
        }

        logger.LogInformation("Stripe event received: {Type}", stripeEvent.Type);

        switch (stripeEvent.Type)
        {
            case EventTypes.PaymentIntentSucceeded:
            {
                var pi = stripeEvent.Data.Object as PaymentIntent;
                await HandlePaymentSucceededAsync(pi!);
                break;
            }
            case EventTypes.PaymentIntentPaymentFailed:
            {
                var pi = stripeEvent.Data.Object as PaymentIntent;
                await HandlePaymentFailedAsync(pi!);
                break;
            }
            case EventTypes.TransferCreated:
            case EventTypes.PayoutPaid:
            {
                var payout = stripeEvent.Data.Object as Payout;
                await HandlePayoutAsync(payout!);
                break;
            }
            default:
                logger.LogInformation("Unhandled Stripe event type: {Type}", stripeEvent.Type);
                break;
        }

        return Ok(new { received = true });
    }

    private async Task HandlePaymentSucceededAsync(PaymentIntent pi)
    {
        var payment = await db.Payments.FindAsync(pi.Metadata.TryGetValue("payment_id", out var pid) ? Guid.Parse(pid) : Guid.Empty);
        if (payment == null) return;
        payment.Status = PaymentStatus.Succeeded;
        payment.StripeChargeId = pi.LatestChargeId;
        await db.SaveChangesAsync();
    }

    private async Task HandlePaymentFailedAsync(PaymentIntent pi)
    {
        var payment = await db.Payments.FindAsync(pi.Metadata.TryGetValue("payment_id", out var pid) ? Guid.Parse(pid) : Guid.Empty);
        if (payment == null) return;
        payment.Status = PaymentStatus.Failed;
        await db.SaveChangesAsync();
    }

    private async Task HandlePayoutAsync(Payout? stripePayout)
    {
        if (stripePayout == null) return;
        logger.LogInformation("Payout {Id} with status {Status}", stripePayout.Id, stripePayout.Status);
        await Task.CompletedTask;
    }
}
