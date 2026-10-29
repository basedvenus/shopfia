import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { enforceRequestRateLimit } from "@/lib/security/request";
import { readRequestPricing, structuredQuoteInput } from "@/lib/structured-quote";
import { applyPromotion, calculateQuote, usd } from "@/lib/service-pricing";

const schema = structuredQuoteInput.extend({ conversationId: z.string().cuid() });
export async function POST(request: Request) {
  const limited = enforceRequestRateLimit(request, [{ key: "structured-quote:ip:{ip}", limit: 24, intervalMs: 60000 }]);
  if (limited) return limited;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in to send a quote." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the quote fields." }, { status: 400 });
  const input = parsed.data;
  try {
    const result = await db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.conversationId}))`;
      const conversation = await tx.conversation.findUnique({ where: { id: input.conversationId } });
      if (!conversation || (session.user.role !== "ADMIN" && conversation.vendorId !== session.user.id)) throw new Error("Quote not found.");
      const source = await tx.quoteRequest.findUnique({ where: { id: input.quoteRequestId }, include: { quote: { include: { orders: true } } } });
      if (!source || source.conversationId !== conversation.id) throw new Error("Quote request not found.");
      const snapshot = readRequestPricing(source.pricingSnapshot);
      if (!snapshot) throw new Error("This request uses the previous quote builder.");
      const latest = await tx.quoteRequest.findFirst({ where: { conversationId: conversation.id, offeringId: source.offeringId }, orderBy: { createdAt: "desc" } });
      if (latest?.id !== source.id || (source.quote?.id ?? null) !== input.previousQuoteId || source.quote?.status === "EXPIRED") throw new Error("This quote changed. Refresh the conversation before editing.");
      // A payment already in progress cannot be silently replaced by another full-price checkout.
      if (source.quote?.orders.some(order => !["canceled", "refunded"].includes(order.status))) throw new Error("This quote has payment activity. Its amount is locked; contact support to arrange a booking change.");
      const lines = input.lines.map(line => ({ ...line, amount: line.rate === null ? null : Math.round(line.quantity * line.rate), calculation: line.rate === null ? "Included in agreed price" : `${line.quantity} ${line.unit} × ${usd(line.rate)}` }));
      const sale = applyPromotion(lines, snapshot.promotions, { now: new Date().toISOString(), eventDate: snapshot.selection.eventDate, code: snapshot.selection.promoCode });
      const totals = calculateQuote(lines, sale.discount, input.finalPrice, input.charges, input.tax, input.depositPercent);
      if (totals.bookingPayment === 0) throw new Error("Choose a booking payment greater than zero, or 100% for full payment.");
      const expiresAt = new Date(Math.min(Date.parse(input.expiresAt), sale.promotion ? Date.parse(sale.promotion.endsAt) : Infinity));
      if (expiresAt <= new Date()) throw new Error("Choose a future quote deadline.");
      const previousMeta = source.quote?.lineItemsJson as { structured?: { version?: number } } | null;
      const version = (previousMeta?.structured?.version ?? 0) + 1;
      const metadata = { title: snapshot.service.name, structured: { id: "", version, status: "sent", createdAt: new Date().toISOString(), expiresAt: expiresAt.toISOString(), lines, charges: input.charges, tax: input.tax, explanation: input.explanation, ...(sale.promotion ? { promotion: sale.promotion } : {}), totals } };
      let requestId = source.id;
      if (source.quote) {
        if (source.quote.status !== "ACCEPTED") await tx.quote.update({ where: { id: source.quote.id }, data: { status: "EXPIRED", lineItemsJson: { ...(source.quote.lineItemsJson as object), superseded: true } } });
        const revision = await tx.quoteRequest.create({ data: { buyerId: source.buyerId, vendorId: source.vendorId, offeringId: source.offeringId, conversationId: source.conversationId, eventDate: source.eventDate, eventLocation: source.eventLocation, notes: source.notes, attachments: source.attachments, pricingSnapshot: source.pricingSnapshot!, status: "RESPONDED" } });
        requestId = revision.id;
      }
      const quote = await tx.quote.create({ data: { quoteRequestId: requestId, amountCents: totals.total, depositAmountCents: totals.bookingPayment < totals.total ? totals.bookingPayment : null, paymentPreference: totals.bookingPayment < totals.total ? "DEPOSIT" : "FULL", expiresAt, status: "SENT", notes: input.explanation, lineItemsJson: metadata } });
      await tx.quoteRequest.update({ where: { id: requestId }, data: { status: "RESPONDED" } });
      await tx.message.create({ data: { conversationId: conversation.id, senderId: session.user.id, body: `Quote version ${version}: ${snapshot.service.name}. Final total ${usd(totals.total)}. Review and approve this quote before payment.`, attachments: [] } });
      await tx.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date() } });
      return { quoteId: quote.id };
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not send quote." }, { status: 400 }); }
}
