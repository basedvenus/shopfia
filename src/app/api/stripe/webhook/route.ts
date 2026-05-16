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

  const [{ db }, { finalizeOrder }] = await Promise.all([
    import("@/lib/db"),
    import("@/lib/services/marketplace-fees")
  ]);
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
  } catch (error) {
    securityLog("stripe_webhook_signature_failed", {
      error: error instanceof Error ? error.message : "unknown"
    });
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;
    const order = await db.order.findFirst({
      where: { stripePaymentIntentId: pi.id },
      select: { id: true, status: true }
    });
    if (order && order.status === "awaiting_payment") {
      await db.order.update({
        where: { id: order.id },
        data: {
          stripeChargeId: typeof pi.latest_charge === "string" ? pi.latest_charge : null
        }
      });
      await finalizeOrder({
        orderId: order.id,
        status: "paid",
        paymentSucceeded: true
      });
    }
  }

  if (event.type === "payment_intent.payment_failed") {
    const pi = event.data.object as Stripe.PaymentIntent;
    await db.order.updateMany({
      where: { stripePaymentIntentId: pi.id, status: "awaiting_payment" },
      data: { status: "canceled" }
    });
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
