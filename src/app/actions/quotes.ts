"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { QuoteRequestStatus, QuoteStatus, UserRole } from "@prisma/client";
import { requireRole, requireVerifiedVendorProfile } from "@/lib/auth/guards";
import { checkServerActionRateLimit } from "@/lib/security/request";
import { prepareQuoteCheckout } from "@/lib/services/quote-checkout";
import { acceptQuoteSchema, quoteRequestSchema, quoteResponseSchema } from "@/lib/validators/quote";

export async function createQuoteRequestAction(formData: FormData) {
  const { db } = await import("@/lib/db");
  const session = await requireRole([UserRole.BUYER, UserRole.ADMIN]);
  const rate = await checkServerActionRateLimit([
    { key: "quote-request:ip:{ip}", limit: 20, intervalMs: 60_000 },
    { key: `quote-request:${session.user.id}`, limit: 10, intervalMs: 60_000 }
  ]);
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

  const vendor = await db.vendorProfile.findUnique({
    where: { id: parsed.vendorId },
    include: { managers: { where: { role: "OWNER" }, select: { userId: true }, take: 1 } }
  });
  if (!vendor) throw new Error("Vendor not found");
  const vendorUserId = vendor.userId ?? vendor.managers[0]?.userId ?? null;
  if (!vendorUserId) throw new Error("This business has not claimed their ShopFia profile yet");
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
      conversationId: null,
      status: QuoteRequestStatus.SUBMITTED
    }
  });

  const conversation = await db.conversation.upsert({
    where: {
      buyerId_vendorId_vendorProfileId: {
        buyerId: session.user.id,
        vendorId: vendorUserId,
        vendorProfileId: vendor.id
      }
    },
    update: { lastMessageAt: new Date() },
    create: {
      buyerId: session.user.id,
      vendorId: vendorUserId,
      vendorProfileId: vendor.id
    }
  });

  await db.quoteRequest.update({
    where: { id: quoteRequest.id },
    data: { conversationId: conversation.id }
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
  const { db } = await import("@/lib/db");
  const session = await requireRole([UserRole.VENDOR, UserRole.ADMIN]);
  const rate = await checkServerActionRateLimit([
    { key: "quote-response:ip:{ip}", limit: 30, intervalMs: 60_000 },
    { key: `quote-response:user:${session.user.id}`, limit: 14, intervalMs: 60_000 }
  ]);
  if (!rate.ok) throw new Error("Rate limit exceeded");
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
    include: { vendor: { include: { managers: { select: { userId: true } } } } }
  });
  if (!quoteRequest) throw new Error("Quote request not found");

  const canManageVendor =
    quoteRequest.vendor.userId === session.user.id ||
    quoteRequest.vendor.managers.some((manager) => manager.userId === session.user.id);
  if (session.user.role !== UserRole.ADMIN && !canManageVendor) {
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

  const quoteVendorUserId = quoteRequest.vendor.userId ?? quoteRequest.vendor.managers[0]?.userId ?? null;
  const conversation = quoteRequest.conversationId
    ? await db.conversation.findUnique({
        where: { id: quoteRequest.conversationId },
        select: { id: true, vendorId: true }
      })
    : quoteVendorUserId
      ? await db.conversation.findUnique({
          where: {
            buyerId_vendorId_vendorProfileId: {
              buyerId: quoteRequest.buyerId,
              vendorId: quoteVendorUserId,
              vendorProfileId: quoteRequest.vendor.id
            }
          },
          select: { id: true, vendorId: true }
        })
      : null;

  if (conversation) {
    await db.quoteRequest.update({
      where: { id: quoteRequest.id },
      data: { conversationId: conversation.id }
    });
    await db.message.create({
      data: {
        attachments: [],
        body: `${quoteRequest.vendor.name} sent a custom quote.`,
        conversationId: conversation.id,
        senderId: conversation.vendorId
      }
    });
    await db.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() }
    });
  }

  revalidatePath("/messages");
  revalidatePath("/vendor/dashboard");
  revalidatePath("/account");
}

export async function acceptQuoteAndCreatePaymentIntentAction(formData: FormData) {
  const session = await requireRole([UserRole.BUYER, UserRole.ADMIN]);
  const rate = await checkServerActionRateLimit([
    { key: "quote-payment:ip:{ip}", limit: 12, intervalMs: 60_000 },
    { key: `quote-payment:user:${session.user.id}`, limit: 5, intervalMs: 60_000 }
  ]);
  if (!rate.ok) throw new Error("Rate limit exceeded");
  const parsed = acceptQuoteSchema.parse({
    quoteId: formData.get("quoteId"),
    payMode: formData.get("payMode") ?? "deposit"
  });
  const result = await prepareQuoteCheckout({
    buyerId: session.user.id,
    origin: await getServerActionOrigin(),
    payMode: parsed.payMode,
    quoteId: parsed.quoteId
  });
  revalidatePath("/messages");
  revalidatePath("/account");
  return result;
}

async function getServerActionOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!host) return process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}
