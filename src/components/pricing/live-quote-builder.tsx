"use client";
import { readRequestPricing } from "@/lib/structured-quote";
import { ServiceQuoteBuilder } from "./service-quote-builder";
import { PricingButton } from "./service-pricing-fields";
import type { QuoteVersion } from "@/lib/service-pricing";
import "./pricing-preview.css";

export function LiveQuoteBuilder({ conversationId, requestId, snapshot, quote, onClose, onSent }: { conversationId: string; requestId: string; snapshot: unknown; quote?: { id: string; lineItemsJson: unknown } | null; onClose: () => void; onSent: () => void }) {
  const request = readRequestPricing(snapshot);
  if (!request) return null;
  const previous = (quote?.lineItemsJson as { structured?: QuoteVersion } | null)?.structured;
  return <div role="dialog" aria-modal="true" aria-label="Build quote" className="fixed inset-0 z-50 bg-black/20 p-3"><div className="mx-auto h-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-5"><div className="sp-workspace" style={{ padding: 0, minHeight: 0 }}><div className="mb-4 flex justify-end"><PricingButton type="button" onClick={onClose}>Close quote builder</PricingButton></div><ServiceQuoteBuilder initialLines={previous?.lines ?? request.lines} initialFinalPrice={previous?.totals.agreed} initialQuote={previous} selection={request.selection} promotions={request.promotions} history={[]} onHistory={() => {}} onSend={async draft => {
    const response = await fetch("/api/messages/structured-quotes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId, quoteRequestId: requestId, previousQuoteId: quote?.id ?? null, lines: draft.lines, finalPrice: draft.totals.agreed, charges: draft.charges, tax: draft.tax, depositPercent: draft.totals.bookingPayment / draft.totals.total * 100, explanation: draft.explanation, expiresAt: draft.expiresAt }) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Could not send quote."); onSent();
  }} /></div></div></div>;
}
