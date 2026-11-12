"use client";

import { PricingButton } from "./service-pricing-fields";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { ChevronDown, X } from "lucide-react";
import { acceptQuoteVersion, applyPromotion, calculateQuote, sendQuoteVersion, usd, type PriceLine, type Promotion, type QuoteVersion, type Selection, type SeparateCharge, type ServicePricing, estimateService } from "@/lib/service-pricing";
import { Field } from "./service-pricing-fields";
import { Calculation } from "./service-request-pricing";

export function BuyerQuote({ quote }: { quote: Omit<QuoteVersion, "status"> & { status: QuoteVersion["status"] | "draft" } }) {
  const t = quote.totals;
  return <section className="sp-card sp-buyer-quote"><p className="sp-eyebrow">Buyer quote · Version {quote.version} · {quote.status}</p><Calculation lines={quote.lines} finalAgreement />
    <details className="sp-disclosure"><summary>Agreed services & inclusions</summary>{quote.lines.map(line => <p key={line.id}><strong>{line.name}</strong><br />{line.scope}</p>)}</details>
    {t.discount > 0 && <div className="sp-total"><span>{quote.promotion?.name ?? "Promotion"}</span><strong>−{usd(t.discount)}</strong></div>}
    {t.adjustment !== 0 && <div className="sp-total"><span>{t.adjustment < 0 ? "One-time discount" : "Price adjustment"}</span><strong>{t.adjustment < 0 ? "−" : "+"}{usd(Math.abs(t.adjustment))}</strong></div>}
    {quote.explanation && <p>{quote.explanation}</p>}
    <div className="sp-total"><span>Agreed service price</span><strong>{usd(t.agreed)}</strong></div>
    {quote.charges.map(charge => <div className="sp-total" key={charge.id}><span>{charge.name}</span><strong>{usd(charge.amount)}</strong></div>)}
    {quote.tax > 0 && <div className="sp-total"><span>Taxes</span><strong>{usd(quote.tax)}</strong></div>}<div className="sp-total sp-grand"><span>Final total</span><strong>{usd(t.total)}</strong></div><div className="sp-total"><span>Deposit</span><strong>{usd(t.bookingPayment)}</strong></div><div className="sp-total"><span>Remaining balance</span><strong>{usd(t.balance)}</strong></div>
    <p className="sp-note">Approve by {new Date(quote.expiresAt).toLocaleString()}. The deposit is part of the final total, not an additional charge.</p>
  </section>;
}

export function ServiceQuoteBuilder({ initialLines, selection, promotions, history, onHistory, onSend, initialFinalPrice, initialQuote, service }: { onSend?: (draft: Omit<QuoteVersion, "id" | "version" | "status" | "createdAt">) => Promise<void>; service?: ServicePricing; initialFinalPrice?: number; initialQuote?: QuoteVersion; initialLines: PriceLine[]; selection: Selection; promotions: Promotion[]; history: QuoteVersion[]; onHistory: (value: QuoteVersion[]) => void }) {
  const [lines, setLines] = useState(initialLines);
  const [finalPrice, setFinalPrice] = useState<number | undefined>(initialFinalPrice);
  const [charges, setCharges] = useState<SeparateCharge[]>(initialQuote?.charges ?? []);
  const tax = initialQuote?.tax ?? 0;
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");
  const [description, setDescription] = useState<{ id: string; left: number; top: number } | null>(null);
  const [discount, setDiscount] = useState<number>();
  const [showDiscount, setShowDiscount] = useState(false);
  const base = service?.base;
  const minimum = base && "minimum" in base && base.type !== "custom" ? base.minimum : 1;
  const primaryId = initialLines[0]?.id;
  const library = service?.extras ?? [];
  function toggleExtra(id: string) {
    if (lines.some(line => line.id === id)) {
      setLines(current => current.filter(line => line.id !== id));
      return;
    }
    if (!service || lines.length >= 50) return;
    const extra = library.find(item => item.id === id);
    if (!extra) return;
    const estimate = estimateService(service, { ...selection, quantity: lines[0]?.quantity ?? selection.quantity, extras: { [id]: extra.minimum } });
    const line = estimate.lines.find(item => item.id === id);
    if (line) {
      setLines(current => [...current, line]);
      setStatus("");
    }
    else setStatus(estimate.errors.join(" "));
  }
  const [deposit, setDeposit] = useState(initialQuote ? initialQuote.totals.bookingPayment / initialQuote.totals.total * 100 : 50);
  const [explanation, setExplanation] = useState(initialQuote?.explanation ?? "");
  const [deadline, setDeadline] = useState(() => new Date(initialQuote?.expiresAt ?? Date.now() + 7 * 86400000).toISOString().slice(0, 16));
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");
  const computedLines = lines.map(line => ({ ...line, amount: line.rate === null ? null : Math.round(line.quantity * line.rate), calculation: line.rate === null ? "Price pending" : `${line.quantity} ${line.unit} × ${usd(line.rate)}` }));
  const sale = applyPromotion(computedLines, promotions, { now: new Date().toISOString(), eventDate: selection.eventDate, code: selection.promoCode });
  const subtotal = computedLines.reduce((sum, line) => sum + (line.amount ?? 0), 0);
  const calculatedPrice = subtotal - sale.discount;
  const agreedPrice = discount === undefined ? finalPrice : calculatedPrice - discount;
  let totals: ReturnType<typeof calculateQuote> | undefined;
  let error = "";
  try { if (lines[0] && lines[0].quantity < minimum) throw new Error(`Minimum service quantity is ${minimum} ${lines[0].unit}.`); totals = calculateQuote(computedLines, sale.discount, agreedPrice, charges, tax, deposit); } catch (e) { error = e instanceof Error ? e.message : "Check quote prices."; }
  const patch = (id: string, values: Partial<PriceLine>) => setLines(lines.map(l => l.id === id ? { ...l, ...values } : l));
  const latest = history.at(-1);
  const requestedDeadline = deadline ? `${deadline}:00Z` : "";
  const effectiveDeadline = sale.promotion && Date.parse(sale.promotion.endsAt) < Date.parse(requestedDeadline) ? sale.promotion.endsAt : requestedDeadline;
  return <div className="sp-stack"><section className="sp-card sp-quote-editor">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2>Line items</h2>
      <Dropdown.Root>
        <Dropdown.Trigger asChild><PricingButton type="button">Add line item <ChevronDown size={15} /></PricingButton></Dropdown.Trigger>
        <Dropdown.Portal>
          <Dropdown.Content align="end" sideOffset={6} className="z-[110] min-w-60 rounded-xl border border-[#eadbd3] bg-white p-1.5 text-sm shadow-xl">
            <Dropdown.Item className="cursor-pointer rounded-lg px-3 py-2.5 outline-none data-[highlighted]:bg-[#fff2ee]" onSelect={() => {
              setLibrarySearch("");
              setLibraryOpen(true);
            }}>Select from service library</Dropdown.Item>
            <Dropdown.Item disabled={lines.length >= 50} className="cursor-pointer rounded-lg px-3 py-2.5 outline-none data-[highlighted]:bg-[#fff2ee] data-[disabled]:opacity-50" onSelect={() => {
              setLines(current => [...current, { id: crypto.randomUUID(), name: "", scope: "", quantity: 1, unit: "item", rate: null, amount: null, calculation: "" }]);
            }}>Create custom line item</Dropdown.Item>
          </Dropdown.Content>
        </Dropdown.Portal>
      </Dropdown.Root>
    </div>
    <Dialog.Root open={libraryOpen} onOpenChange={setLibraryOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[110] bg-[#2f2626]/45" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-[111] flex h-dvh w-full max-w-md flex-col overflow-hidden rounded-l-3xl bg-white shadow-2xl">
          <header className="flex items-center justify-between gap-4 border-b bg-[#fff2ee] px-6 py-4">
            <Dialog.Title className="font-semibold">Service library</Dialog.Title>
            <Dialog.Close aria-label="Close service library" className="rounded-full p-2 hover:bg-white"><X size={18} /></Dialog.Close>
          </header>
          <Dialog.Description className="sr-only">Choose saved add-ons for this quote.</Dialog.Description>
          <div className="flex-1 overflow-y-auto p-5">
            <input aria-label="Search service library" placeholder="Search add-ons" value={librarySearch} onChange={e => setLibrarySearch(e.target.value)} className="mb-4 w-full rounded-xl border px-3 py-2 text-sm" />
            <div className="overflow-hidden rounded-xl border border-[#eadbd3]">
              <div className="flex justify-between bg-[#fff8f5] px-4 py-2 text-xs font-semibold"><span>Name</span><span>Price</span></div>
              {library.filter(extra => extra.name.toLowerCase().includes(librarySearch.trim().toLowerCase())).map(extra => (
                <label key={extra.id} className="flex cursor-pointer items-center gap-3 border-t px-4 py-3 text-sm">
                  <input type="checkbox" checked={lines.some(line => line.id === extra.id)} onChange={() => toggleExtra(extra.id)} />
                  <span className="flex-1">{extra.name}</span><span>{extra.rate == null ? "Custom price" : usd(extra.rate)}</span>
                </label>
              ))}
              {!library.some(extra => extra.name.toLowerCase().includes(librarySearch.trim().toLowerCase())) && <p className="p-4 text-sm text-muted-foreground">{library.length ? "No matching add-ons." : "No saved add-ons for this service."}</p>}
            </div>
          </div>
          <footer className="flex shrink-0 justify-end border-t px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]"><Dialog.Close asChild><PricingButton className="sp-primary" type="button">Done</PricingButton></Dialog.Close></footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
    <div className="overflow-x-auto rounded-xl border border-[#eadbd3]">
      <table className="w-full sp-quote-table table-fixed text-sm">
        <colgroup><col className="w-[23%]" /><col className="w-[31%]" /><col className="w-[17%]" /><col className="w-[14%]" /><col className="w-[15%]" /></colgroup>
        <thead className="bg-[#fff8f5] text-left text-xs font-semibold text-[#594a48]">
          <tr><th className="px-3 py-3">Item</th><th className="px-3">Description</th><th className="px-3">Unit price</th><th className="px-3">Quantity</th><th className="px-3 text-right">Amount</th></tr>
        </thead>
        <tbody>{lines.map((line, index) => (
          <tr className="border-t border-[#eadbd3]" key={line.id}>
            <td className="p-2"><input aria-label={`Item ${index + 1} name`} value={line.name} placeholder="Item name" onChange={e => patch(line.id, { name: e.target.value })} /></td>
            <td className="p-2">
              <button type="button" aria-label={`Edit description for ${line.name || "custom item"}`} className="block w-full truncate rounded-lg px-2 py-2 text-left hover:bg-[#fff2ee]" onClick={event => {
                const rect = event.currentTarget.getBoundingClientRect();
                setDescription({ id: line.id, left: Math.max(12, Math.min(rect.left, window.innerWidth - 332)), top: Math.max(12, rect.top - 168) });
              }}>{line.scope || "Add description"}</button>
            </td>
            <td className="p-2"><QuoteNumber hideLabel label={`Unit price for item ${index + 1}`} value={line.rate ?? undefined} money onChange={rate => patch(line.id, { rate: rate ?? null })} /></td>
            <td className="p-2"><QuoteNumber hideLabel label={`Quantity for item ${index + 1} (${line.unit})`} value={line.quantity || undefined} onChange={quantity => patch(line.id, { quantity: quantity ?? 0 })} /></td>
            <td className="p-3 text-right"><strong className="tabular-nums">{computedLines[index].amount === null ? "Pending" : usd(computedLines[index].amount!)}</strong>
              {line.id !== primaryId && <button type="button" className="block w-full text-right text-xs underline" aria-label={`Remove ${line.name || "custom item"}`} onClick={() => setLines(current => current.filter(item => item.id !== line.id))}>Remove</button>}
            </td>
          </tr>
        ))}</tbody>
      </table>
    </div>
    <Dialog.Root open={description !== null} onOpenChange={open => { if (!open) setDescription(null); }}>
      <Dialog.Portal>
        {description && <Dialog.Content className="fixed z-[111] w-[min(320px,calc(100vw-24px))] rounded-xl border bg-white p-3 shadow-xl" style={{ left: description.left, top: description.top }}>
          <Dialog.Title className="mb-2 text-sm font-semibold">Description</Dialog.Title>
          <Dialog.Description className="sr-only">Edit the description for this line item.</Dialog.Description>
          <textarea aria-label="Line item description" className="w-full rounded-lg border p-2 text-sm" rows={3} value={lines.find(line => line.id === description.id)?.scope ?? ""} onChange={e => patch(description.id, { scope: e.target.value })} />
          <div className="mt-2 flex justify-end"><Dialog.Close asChild><PricingButton type="button">Done</PricingButton></Dialog.Close></div>
        </Dialog.Content>}
      </Dialog.Portal>
    </Dialog.Root>
    <h2>Summary</h2>
    <div className="sp-total"><span>Subtotal</span><strong>{usd(subtotal)}</strong></div>
    {sale.discount > 0 && <div className="sp-total"><span>{sale.promotion?.name}</span><strong>−{usd(sale.discount)}</strong></div>}
    <QuoteNumber label="Final agreed service price" value={agreedPrice} placeholder={(calculatedPrice / 100).toFixed(2)} money onChange={value => { setDiscount(undefined); setFinalPrice(value); }} />
    {totals && totals.adjustment !== 0 && <div className="sp-total"><span>{totals.adjustment < 0 ? "One-time discount" : "Price adjustment"}</span><strong>{totals.adjustment < 0 ? "−" : "+"}{usd(Math.abs(totals.adjustment))}</strong></div>}
    {charges.map(charge => <div className="sp-fields" key={charge.id}>
      <Field label="Fee name"><input value={charge.name} onChange={e => setCharges(charges.map(c => c.id === charge.id ? { ...c, name: e.target.value } : c))} /></Field>
      <QuoteNumber label="Fee amount" value={charge.amount} money onChange={amount => setCharges(charges.map(c => c.id === charge.id ? { ...c, amount: amount ?? 0 } : c))} />
      <PricingButton type="button" onClick={() => setCharges(charges.filter(c => c.id !== charge.id))}>Remove fee</PricingButton>
    </div>)}
    <div className="flex flex-wrap gap-2">
      <PricingButton type="button" aria-expanded={showDiscount} onClick={() => { setShowDiscount(!showDiscount); if (showDiscount) setDiscount(undefined); }}>{showDiscount ? "Remove one-time discount" : "Add one-time discount"}</PricingButton>
      <PricingButton type="button" disabled={charges.length >= 20} onClick={() => setCharges([...charges, { id: crypto.randomUUID(), name: "", amount: 0 }])}>Add one-time fee</PricingButton>
    </div>
    {showDiscount && <QuoteNumber label="Discount amount" value={discount} money onChange={value => { setFinalPrice(undefined); setDiscount(value); }} />}
    {tax > 0 && <div className="sp-total"><span>Existing taxes</span><strong>{usd(tax)}</strong></div>}
    {totals && <>
      <div className="sp-total sp-grand"><span>Total</span><strong>{usd(totals.total)}</strong></div>
      <div className="sp-total"><span>Deposit</span><strong>{usd(totals.bookingPayment)}</strong></div>
    </>}
    <Field label="Comments"><textarea value={explanation} placeholder="Add a note for your customer" onChange={e => setExplanation(e.target.value)} /></Field>
    <div className="sp-fields"><QuoteNumber label="Deposit (%)" value={deposit} onChange={value => setDeposit(value ?? 0)} /><Field label="Quote deadline (UTC)"><input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} /></Field></div>
    {error && <p className="sp-errors" role="alert">{error}</p>}
  </section>
  {totals && <>{!onSend && <BuyerQuote quote={{ id: "draft", version: history.length + 1, status: "draft", createdAt: new Date().toISOString(), expiresAt: effectiveDeadline || new Date().toISOString(), lines: computedLines, charges, tax, explanation, promotion: sale.promotion, totals }} />}<PricingButton className="sp-primary" type="button" disabled={sending} onClick={async () => { if (sending) return; try { if (lines.some(l => !l.name.trim() || !l.scope.trim())) throw new Error("Include a name and agreed scope for every line."); const draft = { expiresAt: effectiveDeadline, lines: computedLines, charges, tax, explanation, promotion: sale.promotion, totals: totals! }; if (onSend) { setSending(true); await onSend(draft); setStatus("Quote sent."); return; } onHistory(sendQuoteVersion(history, draft, new Date().toISOString())); setStatus("Preview quote sent. Switch to the buyer view below to approve this version."); } catch (e) { setStatus((e as Error).message); } finally { setSending(false); } }}>{sending ? "Sending…" : onSend ? "Send quote" : `Send ${history.length ? "revised " : ""}preview quote`}</PricingButton></>}
  {status && <p role="status">{status}</p>}
  {latest && <section className="sp-card"><h2>Buyer approval preview</h2><p className="sp-note">Messages do not change the payable amount. Only an approved formal quote does. No payment is collected in this preview.</p><BuyerQuote quote={latest} /><PricingButton type="button" className="sp-primary" disabled={latest.status !== "sent"} onClick={() => { try { onHistory(acceptQuoteVersion(history, latest.id, new Date().toISOString())); setStatus("Approved in preview. The approved total and deposit are locked to this version."); } catch (e) { setStatus((e as Error).message); } }}>{latest.status === "accepted" ? "Approved" : "Approve current preview quote"}</PricingButton></section>}
  {history.length > 0 && <section className="sp-card"><h3>Quote history</h3>{history.map(quote => <details className="sp-disclosure" key={quote.id}><summary>Version {quote.version} · {quote.status} · {usd(quote.totals.total)}</summary><BuyerQuote quote={quote} /></details>)}<p className="sp-note">Accepted versions remain unchanged. A later revision requires its own approval.</p></section>}
  </div>;
}

function QuoteNumber({ label, value, money, placeholder, onChange, hideLabel }: {
  label: string; value?: number; money?: boolean; placeholder?: string; hideLabel?: boolean;
  onChange: (value: number | undefined) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const input = <input aria-label={label} type="text" inputMode="decimal" placeholder={placeholder} onBlur={() => setEditing(null)}
    value={editing ?? (value === undefined ? "" : money ? value / 100 : value)}
    onChange={event => {
      const raw = event.target.value;
      if (raw !== "" && !/^\d+(?:\.\d{0,2})?$/.test(raw)) return;
      setEditing(raw);
      onChange(raw === "" ? undefined : money ? Math.round(Number(raw) * 100) : Number(raw));
    }}
  />;
  return hideLabel ? input : <Field label={label}>{input}</Field>;
}
