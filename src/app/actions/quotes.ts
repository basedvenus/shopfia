"use server";

import { revalidatePath } from "next/cache";
import { QuoteRequestStatus, QuoteStatus, UserRole } from "@prisma/client";
import { requireRole, requireVerifiedVendorProfile } from "@/lib/auth/guards";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { db } from "@/lib/db";
import { canAcceptQuote, quotePayableAmount } from "@/lib/payments";
import { ensureSellerAccountForVendorProfile } from "@/lib/services/marketplace-fees";
import { getStripeServer } from "@/lib/stripe";
import { acceptQuoteSchema, quoteRequestSchema, quoteResponseSchema } from "@/lib/validators/quote";

export async function createQuoteRequestAction(formData: FormData) {
  const session = await requireRole([UserRole.BUYER, UserRole.ADMIN]);
  const rate = checkRateLimit(`quote-request:${session.user.id}`, 10, 60_000);
  if (!rate.ok) throw new Error("Rate limit exceeded");

  const parsed = quoteRequestSchema.parse({
    vendorId: formData.get("vendorId"),
    offeringId: formData.get("offeringId") || undefined,
    eventDate: formData.get("eventDate") || undefined,
    eventLocation: formData.get("eventLocation"),
    budgetCents: formData.get("budgetCents") || undefined,
    notes: formData.get("notes"),
    attachments: formData.getAll("attachments").map(String).filter(Boolean)
  });

  const vendor = await db.vendorProfile.findUnique({ where: { id: parsed.vendorId } });
  if (!vendor) throw new Error("Vendor not found");
  if (!vendor.verified) throw new Error("Vendor is not accepting platform bookings");

  if (parsed.offeringId) {
    const offering = await db.offering.findUnique({
      where: { id: parsed.offeringId },
      select: { id: true, vendorId: true, active: true }
    });
    if (!offering || !offering.active || offering.vendorId !== parsed.vendorId) {
      throw new Error("Offering does not belong to vendor");
    }
  }

  const quoteRequest = await db.quoteRequest.create({
    data: {
      buyerId: session.user.id,
      vendorId: parsed.vendorId,
      offeringId: parsed.offeringId || null,
      eventDate: parsed.eventDate ? new Date(parsed.eventDate) : null,
      eventLocation: parsed.eventLocation,
      budgetCents: parsed.budgetCents ?? null,
      notes: parsed.notes || null,
      attachments: parsed.attachments,
      status: QuoteRequestStatus.SUBMITTED
    }
  });

  const conversation = await db.conversation.upsert({
    where: {
      buyerId_vendorId: {
        buyerId: session.user.id,
        vendorId: vendor.userId
      }
    },
    update: { lastMessageAt: new Date() },
    create: {
      buyerId: session.user.id,
      vendorId: vendor.userId,
      vendorProfileId: vendor.id
    }
  });

  await db.message.create({
    data: {
      conversationId: conversation.id,
      senderId: session.user.id,
      body: `New quote request submitted for ${parsed.eventLocation}${parsed.eventDate ? ` on ${parsed.eventDate}` : ""}.`,
      attachments: []
    }
  });

  revalidatePath("/messages");
  revalidatePath(`/vendor/profile/${vendor.slug}`);
  return quoteRequest.id;
}

export async function sendQuoteResponseAction(formData: FormData) {
  const session = await requireRole([UserRole.VENDOR, UserRole.ADMIN]);
  if (session.user.role === UserRole.VENDOR) {
    await requireVerifiedVendorProfile(session.user.id);
  }
  const parsed = quoteResponseSchema.parse({
    quoteRequestId: formData.get("quoteRequestId"),
    amountCents: formData.get("amountCents"),
    depositAmountCents: formData.get("depositAmountCents") || undefined,
    expiresAt: formData.get("expiresAt"),
    notes: formData.get("notes"),
    paymentPreference: formData.get("paymentPreference") ?? "DEPOSIT"
  });

  const quoteRequest = await db.quoteRequest.findUnique({
    where: { id: parsed.quoteRequestId },
    include: { vendor: true }
  });
  if (!quoteRequest) throw new Error("Quote request not found");

  if (session.user.role !== UserRole.ADMIN && quoteRequest.vendor.userId !== session.user.id) {
    throw new Error("Forbidden");
  }

  const expiresAt = new Date(parsed.expiresAt);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
    throw new Error("Quote expiration must be a valid future date");
  }
  if (
    parsed.depositAmountCents != null &&
    parsed.depositAmountCents > parsed.amountCents
  ) {
    throw new Error("Deposit cannot exceed total amount");
  }

  await db.quote.upsert({
    where: { quoteRequestId: quoteRequest.id },
    update: {
      amountCents: parsed.amountCents,
      depositAmountCents: parsed.depositAmountCents ?? null,
      expiresAt,
      notes: parsed.notes || null,
      paymentPreference: parsed.paymentPreference,
      status: QuoteStatus.SENT
    },
    create: {
      quoteRequestId: quoteRequest.id,
      amountCents: parsed.amountCents,
      depositAmountCents: parsed.depositAmountCents ?? null,
      expiresAt,
      notes: parsed.notes || null,
      paymentPreference: parsed.paymentPreference,
      status: QuoteStatus.SENT
    }
  });

  await db.quoteRequest.update({
    where: { id: quoteRequest.id },
    data: { status: QuoteRequestStatus.RESPONDED }
  });

  revalidatePath("/messages");
  revalidatePath("/vendor/dashboard");
}

export async function acceptQuoteAndCreatePaymentIntentAction(formData: FormData) {
  const session = await requireRole([UserRole.BUYER, UserRole.ADMIN]);
  const parsed = acceptQuoteSchema.parse({
    quoteId: formData.get("quoteId"),
    payMode: formData.get("payMode") ?? "deposit"
  });

  const quote = await db.quote.findUnique({
    where: { id: parsed.quoteId },
    include: {
      quoteRequest: {
        include: {
          vendor: true
        }
      }
    }
  });
  if (!quote) throw new Error("Quote not found");
  if (quote.quoteRequest.buyerId !== session.user.id && session.user.role !== UserRole.ADMIN) {
    throw new Error("Forbidden");
  }
  if (!canAcceptQuote(quote)) throw new Error("Quote is not payable");

  const existingOrder = await db.order.findFirst({
    where: {
      quoteId: quote.id,
      buyerId: session.user.id,
      status: { in: ["awaiting_payment", "paid", "in_progress", "completed"] }
    },
    select: { id: true, stripePaymentIntentId: true }
  });
  if (existingOrder) {
    throw new Error("Quote already has an active order");
  }

  const amountCents = quotePayableAmount(quote, parsed.payMode);

  const vendorUser = await db.user.findUnique({
    where: { id: quote.quoteRequest.vendor.userId },
    select: { id: true }
  });
  if (!vendorUser) throw new Error("Vendor user not found");

  const { seller, shop } = await ensureSellerAccountForVendorProfile(quote.quoteRequest.vendorId);
  const listing = quote.quoteRequest.offeringId
    ? await db.listing.findUnique({
        where: { offeringId: quote.quoteRequest.offeringId }
      })
    : null;

  const stripe = getStripeServer();
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: "usd",
    automatic_payment_methods: { enabled: true },
    ...(quote.quoteRequest.vendor.stripeAccountId
      ? {
          transfer_data: {
            destination: quote.quoteRequest.vendor.stripeAccountId
          }
        }
      : {}),
    metadata: {
      orderContext: "quote_acceptance",
      quoteId: quote.id,
      buyerId: session.user.id,
      vendorProfileId: quote.quoteRequest.vendorId
    }
  });

  const order = await db.order.create({
    data: {
      buyerId: session.user.id,
      vendorId: vendorUser.id,
      vendorProfileId: quote.quoteRequest.vendorId,
      sellerId: seller.id,
      shopId: shop.id,
      listingId: listing?.id ?? null,
      offeringId: quote.quoteRequest.offeringId,
      quoteId: quote.id,
      amountCents,
      itemSubtotalCents: amountCents,
      buyerTotalCents: amountCents,
      stripePaymentIntentId: paymentIntent.id,
      status: "awaiting_payment"
    }
  });

  await db.quote.update({
    where: { id: quote.id },
    data: { status: QuoteStatus.ACCEPTED }
  });

  await db.quoteRequest.update({
    where: { id: quote.quoteRequest.id },
    data: { status: QuoteRequestStatus.ACCEPTED }
  });

  revalidatePath("/messages");
  revalidatePath("/account");
  return { clientSecret: paymentIntent.client_secret, orderId: order.id };
}
