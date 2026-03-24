import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/db";
import { finalizeOrder } from "@/lib/services/marketplace-fees";
import { getStripeServer } from "@/lib/stripe";

export async function POST(req: Request) {
  const signature = headers().get("stripe-signature");
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
    await db.vendorProfile.updateMany({
      where: { stripeAccountId: account.id },
      data: { stripeOnboardingComplete: !!account.details_submitted }
    });
  }

  return NextResponse.json({ received: true });
}
