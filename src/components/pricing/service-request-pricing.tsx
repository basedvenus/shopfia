"use client";

import { PricingButton } from "./service-pricing-fields";

import { applyPromotion, estimateService, priceLabel, usd, type PriceLine, type Promotion, type Selection, type ServicePricing } from "@/lib/service-pricing";
import { Field, NumberField } from "./service-pricing-fields";

export function Calculation({ lines, finalAgreement = false }: { lines: PriceLine[]; finalAgreement?: boolean }) {
  return <div className="sp-calculation">{lines.map(line => <div key={line.id}><span><strong>{line.name}</strong><small>{line.amount === null && finalAgreement ? `${line.quantity} ${line.unit} · Included in agreed scope` : line.calculation}</small></span><strong>{line.amount === null ? finalAgreement ? "Included in agreed price" : "Price pending" : usd(line.amount)}</strong></div>)}</div>;
}
export function ServiceRequestPricing({ service, selection, onChange, promotions, now, onRequest, requestLabel = "Preview request → quote", disabled = false }: { requestLabel?: string; disabled?: boolean; service: ServicePricing; selection: Selection; onChange: (value: Selection) => void; promotions: Promotion[]; now: string; onRequest: () => void }) {
  const b = service.base;
  const estimate = estimateService(service, selection);
  const sale = applyPromotion(estimate.lines, promotions, { now, code: selection.promoCode, eventDate: selection.eventDate });
  const set = (patch: Partial<Selection>) => onChange({ ...selection, ...patch });
  const selected = service.extras.filter(extra => selection.extras[extra.id] !== undefined);
  const needsGuests = b.type !== "person" && selected.some(e => e.type === "person");
  const needsHours = b.type !== "hour" && selected.some(e => e.type === "hour" && !e.separateHours);
  return <div className="sp-stack"><section className="sp-card"><p className="sp-eyebrow">Customer request</p><h2>{service.name}</h2><p>{service.description}</p><div><p className="sp-eyebrow">{b.type === "custom" ? "Custom pricing" : "Base price"}</p><p className="sp-price">{priceLabel(service)}</p></div><div className="sp-buyer-price-note"><strong>{b.type === "custom" ? "Your quote is tailored to your request." : "Base prices cover the listed inclusions."}</strong>Optional add-ons and customizations may increase your estimate. Any separate charges will be shown in your final quote for approval before payment. Your approved price won’t change without your approval.</div><p className="sp-note">Includes: {service.inclusions}</p>
    {(b.type === "hour" || b.type === "person" || b.type === "item") && <NumberField label={b.type === "hour" ? "Hours" : b.type === "person" ? "Guest count" : `${b.label} quantity`} value={selection.quantity} min={b.minimum} max={b.type === "person" ? b.maximum : undefined} step={b.type === "person" ? 1 : b.increment} onChange={quantity => set({ quantity })} />}
    {b.type === "package" && <Field label="Choose a package"><select value={selection.packageId ?? ""} onChange={e => set({ packageId: e.target.value })}>{b.packages.map(pkg => <option key={pkg.id} value={pkg.id}>{pkg.name} · {usd(pkg.price)} · {pkg.coverage}</option>)}</select><small>{b.packages.find(p => p.id === selection.packageId)?.inclusions}</small></Field>}
    {b.type === "custom" && b.questions.map((question, i) => <Field key={i} label={question}><textarea value={selection.answers[i] ?? ""} onChange={e => { const answers = [...selection.answers]; answers[i] = e.target.value; set({ answers }); }} /></Field>)}
    <div className="sp-fields"><Field label="Event date"><input type="date" value={selection.eventDate} onChange={e => set({ eventDate: e.target.value })} /></Field><Field label="Event location"><input value={selection.location} placeholder="Type event location here" onChange={e => set({ location: e.target.value })} /></Field></div>
    {service.extras.length > 0 && <><h3>Customize your order</h3>{service.extras.map(extra => {
      const checked = selection.extras[extra.id] !== undefined;
      const independent = extra.type === "item" || (extra.type === "hour" && extra.separateHours);
      return <div className="sp-extra" key={extra.id}><label className="sp-check"><input type="checkbox" checked={checked} onChange={e => { const extras = { ...selection.extras }; if (e.target.checked) extras[extra.id] = independent ? extra.minimum : true; else delete extras[extra.id]; set({ extras }); }} /><span><strong>{extra.name}</strong><small>{extra.description}</small></span><strong>{extra.type === "quoted" ? "Price pending" : `+${usd(extra.rate!)}${extra.type === "flat" ? "" : `/${extra.type}`}`}</strong></label>
        {checked && independent && <NumberField label={`${extra.name} ${extra.type === "hour" ? "hours" : "quantity"}`} value={Number(selection.extras[extra.id])} min={extra.minimum} max={extra.maximum} step={extra.increment} onChange={quantity => set({ extras: { ...selection.extras, [extra.id]: quantity ?? 0 } })} />}
        {checked && (extra.type === "person" || (extra.type === "hour" && !extra.separateHours)) && <small className="sp-note">Uses {extra.type === "person" ? `${b.type === "person" ? selection.quantity ?? "—" : selection.guests ?? "—"} guests from this request` : `${b.type === "hour" ? selection.quantity ?? "—" : selection.hours ?? "—"} hours from this request`}.</small>}
        {extra.locationRequired && <small className="sp-note">Event location required{extra.type === "quoted" ? " to calculate this charge" : ""}.</small>}
      </div>;
    })}</>}
    {needsGuests && <NumberField label="Guest count for extras" value={selection.guests} onChange={guests => set({ guests })} />}
    {needsHours && <NumberField label="Hours for extras" value={selection.hours} step={0.5} min={0.5} onChange={hours => set({ hours })} />}
    {promotions.some(p => p.code) && <Field label="Promo code (optional)"><input value={selection.promoCode} onChange={e => set({ promoCode: e.target.value })} />{selection.promoCode && !sale.promotion && <small>No eligible promotion for these selections and dates.</small>}</Field>}
  </section><section className="sp-card" aria-live="polite"><h3>Your estimate</h3><Calculation lines={estimate.lines} />
    {sale.promotion && estimate.errors.length === 0 && <div className="sp-sale"><span>Regular subtotal <s>{usd(estimate.subtotal)}</s></span><strong>{sale.promotion.name}: −{usd(sale.discount)}</strong><small>Book by {new Date(sale.promotion.endsAt).toLocaleString("en-US", { timeZone: sale.promotion.timezone })} ({sale.promotion.timezone}). {sale.promotion.eventFrom || sale.promotion.eventTo ? `Event dates: ${sale.promotion.eventFrom || "any"} – ${sale.promotion.eventTo || "any"}.` : ""} Applies to eligible selections only. Promotions do not stack.</small></div>}
    <div className="sp-total"><span>Estimated service subtotal</span><strong>{estimate.errors.length ? "Complete selections" : estimate.pending && estimate.subtotal === 0 ? "Awaiting quote" : usd(estimate.subtotal - sale.discount)}</strong></div>
    {estimate.pending && <p className="sp-pending">Additional pricing pending</p>}
    {estimate.errors.length > 0 && <ul className="sp-errors">{estimate.errors.map(error => <li key={error}>{error}</li>)}</ul>}
    <p className="sp-note">Submitting a request does not approve a final quote or authorize payment.</p><PricingButton type="button" className="sp-primary" disabled={disabled || estimate.errors.length > 0} onClick={onRequest}>{requestLabel}</PricingButton>
  </section></div>;
}
