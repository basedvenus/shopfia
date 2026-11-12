"use client";
import { readRequestPricing } from "@/lib/structured-quote";
import { ServiceQuoteBuilder } from "./service-quote-builder";
import { X } from "lucide-react";
import type { QuoteVersion } from "@/lib/service-pricing";
import "./pricing-preview.css";

export function LiveQuoteBuilder({ conversationId, requestId, snapshot, quote, onClose, onSent }: { conversationId: string; requestId: string; snapshot: unknown; quote?: { id: string; lineItemsJson: unknown } | null; onClose: () => void; onSent: () => void }) {
  const request = readRequestPricing(snapshot);
  if (!request) return null;
  const previous = (quote?.lineItemsJson as { structured?: QuoteVersion } | null)?.structured;
  return <div role="dialog" aria-modal="true" aria-label="Build quote" className="fixed inset-0 z-50 bg-black/20 p-2 sm:p-3"><div className="mx-auto h-full max-w-5xl overflow-y-auto overscroll-contain rounded-3xl bg-white p-2 sm:p-5"><div className="sp-workspace" style={{ padding: 0, minHeight: 0 }}><div className="sticky top-0 z-10 mb-2 flex justify-end bg-white">
    <button type="button" aria-label="Close quote builder" onClick={onClose} className="grid size-10 place-items-center rounded-full border bg-white text-[#8a5c58]"><X size={20} /></button>
  </div><ServiceQuoteBuilder initialLines={previous?.lines ?? request.lines} initialFinalPrice={previous && previous.totals.agreed !== previous.totals.calculated ? previous.totals.agreed : undefined} service={request.service} initialQuote={previous} selection={request.selection} promotions={request.promotions} history={[]} onHistory={() => {}} onSend={async draft => {
    const response = await fetch("/api/messages/structured-quotes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId, quoteRequestId: requestId, previousQuoteId: quote?.id ?? null, lines: draft.lines, finalPrice: draft.totals.agreed, charges: draft.charges, tax: draft.tax, depositPercent: draft.totals.bookingPayment / draft.totals.total * 100, explanation: draft.explanation, expiresAt: draft.expiresAt }) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Could not send quote."); onSent();
  }} /></div></div></div>;
}
