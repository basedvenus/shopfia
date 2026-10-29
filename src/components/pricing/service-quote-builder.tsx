"use client";

import { PricingButton } from "./service-pricing-fields";

import { useState } from "react";
import { acceptQuoteVersion, applyPromotion, calculateQuote, sendQuoteVersion, usd, type PriceLine, type Promotion, type QuoteVersion, type Selection, type SeparateCharge } from "@/lib/service-pricing";
import { Field, Money, NumberField } from "./service-pricing-fields";
import { Calculation } from "./service-request-pricing";

export function BuyerQuote({ quote }: { quote: Omit<QuoteVersion, "status"> & { status: QuoteVersion["status"] | "draft" } }) {
  const t = quote.totals;
  return <section className="sp-card"><p className="sp-eyebrow">Buyer quote · Version {quote.version} · {quote.status}</p><h2>Your event, agreed.</h2><Calculation lines={quote.lines} finalAgreement />
    <details className="sp-disclosure"><summary>Agreed services & inclusions</summary>{quote.lines.map(line => <p key={line.id}><strong>{line.name}</strong><br />{line.scope}</p>)}</details>
    {t.discount > 0 && <div className="sp-total"><span>{quote.promotion?.name ?? "Promotion"}</span><strong>−{usd(t.discount)}</strong></div>}
    {t.adjustment !== 0 && <div className="sp-total"><span>Negotiated adjustment</span><strong>{t.adjustment < 0 ? "−" : "+"}{usd(Math.abs(t.adjustment))}</strong></div>}
    {quote.explanation && <p>{quote.explanation}</p>}
    <div className="sp-total"><span>Agreed service price</span><strong>{usd(t.agreed)}</strong></div>
    {quote.charges.map(charge => <div className="sp-total" key={charge.id}><span>{charge.name}</span><strong>{usd(charge.amount)}</strong></div>)}
    <div className="sp-total"><span>Taxes</span><strong>{usd(quote.tax)}</strong></div><div className="sp-total sp-grand"><span>Final total</span><strong>{usd(t.total)}</strong></div><div className="sp-total"><span>Booking payment</span><strong>{usd(t.bookingPayment)}</strong></div><div className="sp-total"><span>Remaining balance</span><strong>{usd(t.balance)}</strong></div>
    <p className="sp-note">Approve by {new Date(quote.expiresAt).toLocaleString()}. The booking payment is part of the final total, not an additional charge.</p>
  </section>;
}

export function ServiceQuoteBuilder({ initialLines, selection, promotions, history, onHistory, onSend, initialFinalPrice, initialQuote }: { onSend?: (draft: Omit<QuoteVersion, "id" | "version" | "status" | "createdAt">) => Promise<void>; initialFinalPrice?: number; initialQuote?: QuoteVersion; initialLines: PriceLine[]; selection: Selection; promotions: Promotion[]; history: QuoteVersion[]; onHistory: (value: QuoteVersion[]) => void }) {
  const [lines, setLines] = useState(initialLines);
  const [finalPrice, setFinalPrice] = useState<number | undefined>(initialFinalPrice);
  const [charges, setCharges] = useState<SeparateCharge[]>(initialQuote?.charges ?? []);
  const [tax, setTax] = useState(initialQuote?.tax ?? 0);
  const [deposit, setDeposit] = useState(initialQuote ? initialQuote.totals.bookingPayment / initialQuote.totals.total * 100 : 50);
  const [explanation, setExplanation] = useState(initialQuote?.explanation ?? "");
  const [deadline, setDeadline] = useState(() => new Date(initialQuote?.expiresAt ?? Date.now() + 7 * 86400000).toISOString().slice(0, 16));
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");
  const computedLines = lines.map(line => ({ ...line, amount: line.rate === null ? null : Math.round(line.quantity * line.rate), calculation: line.rate === null ? "Price pending" : `${line.quantity} ${line.unit} × ${usd(line.rate)}` }));
  const sale = applyPromotion(computedLines, promotions, { now: new Date().toISOString(), eventDate: selection.eventDate, code: selection.promoCode });
  let totals: ReturnType<typeof calculateQuote> | undefined;
  let error = "";
  try { totals = calculateQuote(computedLines, sale.discount, finalPrice, charges, tax, deposit); } catch (e) { error = e instanceof Error ? e.message : "Check quote prices."; }
  const patch = (id: string, values: Partial<PriceLine>) => setLines(lines.map(l => l.id === id ? { ...l, ...values } : l));
  const latest = history.at(-1);
  const requestedDeadline = deadline ? `${deadline}:00Z` : "";
  const effectiveDeadline = sale.promotion && Date.parse(sale.promotion.endsAt) < Date.parse(requestedDeadline) ? sale.promotion.endsAt : requestedDeadline;
  return <div className="sp-stack"><section className="sp-card"><p className="sp-eyebrow">Vendor quote</p><h2>Agree on the details.</h2><p className="sp-note">The customer’s selections are carried in below. You may make an exception to a service minimum here.</p>
    <details className="sp-disclosure" open={computedLines.some(l => l.rate === null)}><summary>Edit quantities, rates or scope</summary>{lines.map(line => <div className="sp-line-editor" key={line.id}><Field label="Line item"><input value={line.name} onChange={e => patch(line.id, { name: e.target.value })} /></Field><Field label="Agreed scope"><textarea value={line.scope} onChange={e => patch(line.id, { scope: e.target.value })} /></Field><div className="sp-fields"><NumberField label={`Quantity (${line.unit})`} value={line.quantity} min={0.01} step={0.01} onChange={quantity => patch(line.id, { quantity: quantity ?? 0 })} /><Money label="Unit rate" value={line.rate ?? undefined} onChange={rate => patch(line.id, { rate: rate ?? null })} /></div></div>)}</details>
    {sale.promotion && <p className="sp-note">{sale.promotion.name}: −{usd(sale.discount)} on eligible lines. Approve by {new Date(sale.promotion.endsAt).toLocaleString("en-US", { timeZone: sale.promotion.timezone })} ({sale.promotion.timezone}). The quote deadline cannot extend beyond this promotion’s booking deadline.</p>}
    <Money label="Final agreed service price" value={finalPrice ?? totals?.calculated} onChange={setFinalPrice} />
    <p className="sp-note">Covers every listed service and add-on, after promotions. Separate charges and taxes are added below.</p>
    {finalPrice !== undefined && <PricingButton type="button" className="sp-link" onClick={() => setFinalPrice(undefined)}>Use calculated price</PricingButton>}
    {totals && totals.adjustment !== 0 && <p className="sp-pending">Negotiated adjustment: {totals.adjustment < 0 ? "−" : "+"}{usd(Math.abs(totals.adjustment))}</p>}
    <Field label="Explanation (optional)"><textarea value={explanation} placeholder="Add a note about the agreement" onChange={e => setExplanation(e.target.value)} /></Field>
    <details className="sp-disclosure"><summary>Separate charges & taxes</summary><p className="sp-note">Only add charges not already included above. Confirm location-dependent charges before sending.</p>{charges.map(charge => <div className="sp-line-editor" key={charge.id}><Field label="Charge name"><input value={charge.name} placeholder="Type charge name here" onChange={e => setCharges(charges.map(c => c.id === charge.id ? { ...c, name: e.target.value } : c))} /></Field><Money label="Charge amount" value={charge.amount} onChange={amount => setCharges(charges.map(c => c.id === charge.id ? { ...c, amount: amount ?? 0 } : c))} /><PricingButton type="button" className="sp-link" onClick={() => setCharges(charges.filter(c => c.id !== charge.id))}>Remove charge</PricingButton></div>)}<PricingButton type="button" onClick={() => setCharges([...charges, { id: crypto.randomUUID(), name: "", amount: 0 }])}>+ Add separate charge</PricingButton><Money label="Applicable taxes" value={tax} onChange={value => setTax(value ?? 0)} /></details>
    <div className="sp-fields"><NumberField label="Booking payment (%)" min={0} max={100} value={deposit} onChange={value => setDeposit(value ?? 0)} /><Field label="Quote deadline (UTC)"><input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} /></Field></div>
    {error && <p className="sp-errors" role="alert">{error}</p>}
  </section>
  {totals && <><BuyerQuote quote={{ id: "draft", version: history.length + 1, status: "draft", createdAt: new Date().toISOString(), expiresAt: effectiveDeadline || new Date().toISOString(), lines: computedLines, charges, tax, explanation, promotion: sale.promotion, totals }} /><PricingButton className="sp-primary" type="button" disabled={sending} onClick={async () => { if (sending) return; try { if (lines.some(l => !l.name.trim() || !l.scope.trim())) throw new Error("Include a name and agreed scope for every line."); const draft = { expiresAt: effectiveDeadline, lines: computedLines, charges, tax, explanation, promotion: sale.promotion, totals: totals! }; if (onSend) { setSending(true); await onSend(draft); setStatus("Quote sent."); return; } onHistory(sendQuoteVersion(history, draft, new Date().toISOString())); setStatus("Preview quote sent. Switch to the buyer view below to approve this version."); } catch (e) { setStatus((e as Error).message); } finally { setSending(false); } }}>{sending ? "Sending…" : onSend ? "Send quote" : `Send ${history.length ? "revised " : ""}preview quote`}</PricingButton></>}
  {status && <p role="status">{status}</p>}
  {latest && <section className="sp-card"><h2>Buyer approval preview</h2><p className="sp-note">Messages do not change the payable amount. Only an approved formal quote does. No payment is collected in this preview.</p><BuyerQuote quote={latest} /><PricingButton type="button" className="sp-primary" disabled={latest.status !== "sent"} onClick={() => { try { onHistory(acceptQuoteVersion(history, latest.id, new Date().toISOString())); setStatus("Approved in preview. The approved total and booking payment are locked to this version."); } catch (e) { setStatus((e as Error).message); } }}>{latest.status === "accepted" ? "Approved" : "Approve current preview quote"}</PricingButton></section>}
  {history.length > 0 && <section className="sp-card"><h3>Quote history</h3>{history.map(quote => <details className="sp-disclosure" key={quote.id}><summary>Version {quote.version} · {quote.status} · {usd(quote.totals.total)}</summary><BuyerQuote quote={quote} /></details>)}<p className="sp-note">Accepted versions remain unchanged. A later revision requires its own approval.</p></section>}
  </div>;
}
