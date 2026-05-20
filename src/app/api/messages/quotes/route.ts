import { NextResponse } from "next/server";
import { OrderStatus, QuoteRequestStatus, QuoteStatus, UserRole } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { enforceRequestRateLimit } from "@/lib/security/request";

export const dynamic = "force-dynamic";

const lineItemSchema = z.object({
  description: z.string().trim().min(1).max(120),
  quantity: z.coerce.number().min(1).max(999),
  unitAmountCents: z.coerce.number().int().min(0).max(10_000_000)
});

const quoteBuilderSchema = z.object({
  conversationId: z.string().cuid(),
  deliveryFeeCents: z.coerce.number().int().min(0).max(10_000_000).default(0),
  depositPercent: z.coerce.number().int().min(0).max(100).default(50),
  expiresAt: z.string().min(1),
  lineItems: z.array(lineItemSchema).min(1).max(12),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  paymentPreference: z.enum(["DEPOSIT", "FULL"]).default("DEPOSIT"),
  setupFeeCents: z.coerce.number().int().min(0).max(10_000_000).default(0),
  taxCents: z.coerce.number().int().min(0).max(10_000_000).default(0),
  title: z.string().trim().min(2).max(120)
});

const LOCKED_ORDER_STATUSES = [
  OrderStatus.awaiting_payment,
  OrderStatus.paid,
  OrderStatus.in_progress,
  OrderStatus.completed
] as const;

export async function POST(request: Request) {
  const limited = enforceRequestRateLimit(request, [
    { key: "quote-builder:ip:{ip}", limit: 24, intervalMs: 60_000 }
  ]);
  if (limited) return limited;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== UserRole.VENDOR && session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Only vendors can build quotes." }, { status: 403 });
  }

  const parsed = quoteBuilderSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the quote details and try again." }, { status: 400 });
  }

  const conversation = await db.conversation.findUnique({
    where: { id: parsed.data.conversationId },
    include: {
      buyer: { select: { id: true } },
      inquiries: { orderBy: { createdAt: "desc" }, take: 1 },
      offering: { select: { id: true } },
      vendorProfile: { select: { city: true, id: true, name: true, state: true, userId: true } }
    }
  });

  if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  if (session.user.role !== UserRole.ADMIN && conversation.vendorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const expiresAt = new Date(parsed.data.expiresAt);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
    return NextResponse.json({ error: "Choose a future expiration date." }, { status: 400 });
  }

  const lineItemsTotal = parsed.data.lineItems.reduce(
    (sum, item) => sum + Math.round(item.quantity * item.unitAmountCents),
    0
  );
  const amountCents =
    lineItemsTotal + parsed.data.setupFeeCents + parsed.data.deliveryFeeCents + parsed.data.taxCents;
  if (amountCents <= 0) {
    return NextResponse.json({ error: "Quote total must be greater than $0." }, { status: 400 });
  }

  const depositAmountCents =
    parsed.data.paymentPreference === "DEPOSIT"
      ? Math.max(1, Math.round(amountCents * (parsed.data.depositPercent / 100)))
      : null;
  const latestInquiry = conversation.inquiries[0];
  const eventLocation =
    latestInquiry?.formattedAddress ??
    latestInquiry?.eventLocation ??
    [conversation.vendorProfile.city, conversation.vendorProfile.state].filter(Boolean).join(", ") ??
    "Event location TBD";

  const result = await db.$transaction(async (tx) => {
    const quoteRequest =
      (await tx.quoteRequest.findFirst({
        where: {
          buyerId: conversation.buyerId,
          offeringId: conversation.offeringId ?? undefined,
          vendorId: conversation.vendorProfileId
        },
        orderBy: { createdAt: "desc" }
      })) ??
      (await tx.quoteRequest.create({
        data: {
          attachments: latestInquiry?.inspirationUrls ?? [],
          budgetCents: latestInquiry?.budgetCents ?? null,
          buyerId: conversation.buyerId,
          eventDate: latestInquiry?.eventDate ?? null,
          eventLocation,
          notes: latestInquiry?.message ?? null,
          offeringId: conversation.offeringId ?? null,
          status: QuoteRequestStatus.SUBMITTED,
          vendorId: conversation.vendorProfileId
        }
      }));

    const existingQuote = await tx.quote.findUnique({
      where: { quoteRequestId: quoteRequest.id },
      select: {
        id: true,
        orders: {
          where: { status: { in: [...LOCKED_ORDER_STATUSES] } },
          select: { id: true, status: true },
          take: 1
        }
      }
    });

    if (existingQuote?.orders.length) {
      throw new Error("QUOTE_LOCKED_BY_PAYMENT");
    }

    const quote = await tx.quote.upsert({
      where: { quoteRequestId: quoteRequest.id },
      update: {
        amountCents,
        depositAmountCents,
        expiresAt,
        lineItemsJson: {
          deliveryFeeCents: parsed.data.deliveryFeeCents,
          lineItems: parsed.data.lineItems,
          setupFeeCents: parsed.data.setupFeeCents,
          taxCents: parsed.data.taxCents,
          title: parsed.data.title
        },
        notes: parsed.data.notes || null,
        paymentPreference: parsed.data.paymentPreference,
        status: QuoteStatus.SENT
      },
      create: {
        amountCents,
        depositAmountCents,
        expiresAt,
        lineItemsJson: {
          deliveryFeeCents: parsed.data.deliveryFeeCents,
          lineItems: parsed.data.lineItems,
          setupFeeCents: parsed.data.setupFeeCents,
          taxCents: parsed.data.taxCents,
          title: parsed.data.title
        },
        notes: parsed.data.notes || null,
        paymentPreference: parsed.data.paymentPreference,
        quoteRequestId: quoteRequest.id,
        status: QuoteStatus.SENT
      }
    });

    await tx.quoteRequest.update({
      where: { id: quoteRequest.id },
      data: { status: QuoteRequestStatus.RESPONDED }
    });

    await tx.message.create({
      data: {
        attachments: [],
        body: existingQuote
          ? `${conversation.vendorProfile.name} revised the proposal: ${parsed.data.title}`
          : `${conversation.vendorProfile.name} sent a custom quote: ${parsed.data.title}`,
        conversationId: conversation.id,
        senderId: conversation.vendorId
      }
    });

    await tx.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() }
    });

    return { quoteId: quote.id };
  }).catch((error: unknown) => {
    if (isLockedQuoteError(error)) {
      return null;
    }
    throw error;
  });

  if (!result) {
    return NextResponse.json(
      { error: "This booking has payment activity, so the original quote is locked." },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true, quoteId: result.quoteId });
}

function isLockedQuoteError(error: unknown) {
  return error instanceof Error && error.message === "QUOTE_LOCKED_BY_PAYMENT";
}
