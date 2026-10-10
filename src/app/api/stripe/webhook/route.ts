import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getConnectReadiness, getStripeServer } from "@/lib/stripe";
import { enforceRequestRateLimit } from "@/lib/security/request";
import { securityLog } from "@/lib/security/audit-log";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const limited = enforceRequestRateLimit(req, [
    { key: "stripe-webhook:ip:{ip}", limit: 120, intervalMs: 60_000 }
  ]);
  if (limited) return limited;

  const signature = (await headers()).get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) {
    return NextResponse.json({ error: "Missing webhook secret/signature" }, { status: 400 });
  }

  const body = await req.text();
  const stripe = getStripeServer();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch {
    securityLog("stripe_webhook_signature_failed");
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  const [{ db }, { finalizeOrder }] = await Promise.all([
    import("@/lib/db"),
    import("@/lib/services/marketplace-fees")
  ]);

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;
    const order = await db.order.findFirst({
      where: { stripePaymentIntentId: pi.id },
      select: { id: true, paymentSucceededAt: true }
    });
    if (order && !order.paymentSucceededAt) {
      const linked = await db.order.updateMany({
        where: { id: order.id, stripePaymentIntentId: pi.id, paymentSucceededAt: null },
        data: { stripeChargeId: typeof pi.latest_charge === "string" ? pi.latest_charge : null }
      });
      if (linked.count > 0) {
        await finalizeOrder({ orderId: order.id, status: "paid", paymentSucceeded: true });
      }
    }
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId ?? null;
    const paymentIntentId =
      typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
    const order = await db.order.findFirst({
      // A signed event must still belong to this order's Checkout. Metadata
      // alone is not an ownership binding and must not replace another session.
      where: {
        stripeCheckoutSessionId: session.id,
        ...(orderId ? { id: orderId } : {})
      },
      select: { id: true, paymentSucceededAt: true }
    });
    if (order && !order.paymentSucceededAt) {
      const chargeId = await getCheckoutChargeId(paymentIntentId);
      const linked = await db.order.updateMany({
        where: { id: order.id, stripeCheckoutSessionId: session.id, paymentSucceededAt: null },
        data: {
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: paymentIntentId,
          stripeChargeId: chargeId
        }
      });

      if (linked.count > 0 && session.payment_status === "paid") {
        await finalizeOrder({
          orderId: order.id,
          status: "paid",
          paymentSucceeded: true
        });
      }
    }
  }

  if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
    const session = event.data.object as Stripe.Checkout.Session;
    await db.order.updateMany({
      where: {
        stripeCheckoutSessionId: session.id,
        status: "awaiting_payment",
        paymentSucceededAt: null
      },
      data: { status: "canceled" }
    });
  }

  if (event.type === "payment_intent.payment_failed") {
    // A declined attempt is retryable within the same Checkout/PaymentIntent.
    // Do not cancel the order: a later verified success must still settle it.
    // Checkout expiry, rather than an individual failed attempt, closes it.
  }

  if (event.type === "account.updated") {
    const account = event.data.object as Stripe.Account;
    const readiness = getConnectReadiness(account);
    await db.vendorProfile.updateMany({
      where: { stripeAccountId: account.id },
      data: {
        stripeOnboardingComplete: readiness.onboardingComplete,
        stripeChargesEnabled: readiness.chargesEnabled,
        stripePayoutsEnabled: readiness.payoutsEnabled
      }
    });
  }

  return NextResponse.json({ received: true });
}

async function getCheckoutChargeId(paymentIntentId: string | null) {
  if (!paymentIntentId) return null;
  const stripe = getStripeServer();
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  return typeof paymentIntent.latest_charge === "string" ? paymentIntent.latest_charge : null;
}
