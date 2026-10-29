"use client";

import { PricingButton } from "./service-pricing-fields";

import { useEffect, useState } from "react";
import { estimateService, initialSelection, priceLabel, servicePricingSchema, type PriceLine, type Promotion, type QuoteVersion, type Selection, type ServicePricing } from "@/lib/service-pricing";
import { ServicePricingFields } from "./service-pricing-fields";
import { ServiceRequestPricing } from "./service-request-pricing";
import { ServiceQuoteBuilder } from "./service-quote-builder";
import { ServicePromotions } from "./service-promotions";
import "./pricing-preview.css";

import { serviceTemplates as samples } from "@/lib/service-templates";

const steps = ["Service builder", "Customer request", "Final quote", "Promotions"] as const;
const storageKey = "shopfia-pricing-preview-v1";
export function PricingPreview() {
  const [service, setService] = useState<ServicePricing>(samples.blank);
  const [selection, setSelection] = useState<Selection>(initialSelection(samples.blank));
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [history, setHistory] = useState<QuoteVersion[]>([]);
  const [quoteLines, setQuoteLines] = useState<PriceLine[]>([]);
  const [quoteSelection, setQuoteSelection] = useState<Selection>(selection);
  const [requestVersion, setRequestVersion] = useState(0);
  const [step, setStep] = useState(0);
  const [notice, setNotice] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState("");
  useEffect(() => {
    setNow(new Date().toISOString());
    try { const stored = localStorage.getItem(storageKey); if (stored) { const raw = JSON.parse(stored); const parsed = servicePricingSchema.safeParse(raw.service); if (parsed.success) { setService(parsed.data); setSelection(raw.selection ?? initialSelection(parsed.data)); setPromotions(raw.promotions ?? []); setHistory(raw.history ?? []); setQuoteLines(raw.quoteLines ?? []); setQuoteSelection(raw.quoteSelection ?? initialSelection(parsed.data)); } } } catch { /* Storage is optional in the preview. */ }
    setLoaded(true);
  }, []);
  const valid = servicePricingSchema.safeParse(service);
  function savePreview() {
    if (!valid.success) { setNotice("Complete the required service fields before saving."); return; }
    try { localStorage.setItem(storageKey, JSON.stringify({ service, selection, promotions, history, quoteLines, quoteSelection })); setNotice("Saved in this browser only. Production is unchanged."); } catch { setNotice("Browser storage is unavailable. Keep this tab open to retain your preview."); }
  }
  function changeService(next: ServicePricing) {
    if (next.base.type !== service.base.type) setSelection(initialSelection(next));
    setService(next);
  }
  function applyTemplate(key: string) {
    const next = structuredClone(samples[key]);
    setService(next); setSelection(initialSelection(next)); setPromotions([]); setQuoteLines([]); setHistory([]); setStep(0);
    setNotice(key === "blank" ? "Blank service ready." : "Template applied. Prices are examples—set your own rates and adjust the description, inclusions and extras before saving.");
  }
  function requestQuote() {
    if (!valid.success) return;
    const estimate = estimateService(valid.data, selection);
    if (estimate.errors.length) return;
    setQuoteLines(structuredClone(estimate.lines)); setQuoteSelection(structuredClone(selection)); setRequestVersion(v => v + 1); setStep(2); setNotice("Request copied into the quote. Nothing was sent to a customer.");
  }
  return <div className="sp-workspace"><header className="sp-header"><span className="sp-badge">Preview only</span><PricingButton type="button" onClick={savePreview}>Save preview</PricingButton></header>
    <div className="sp-intro"><div><h1>Your services</h1><p>Start with a template or build your own. Every detail is editable.</p></div></div>
    <nav className="sp-tabs" aria-label="Pricing workflow">{steps.map((label, i) => <PricingButton type="button" key={label} aria-current={step === i ? "step" : undefined} disabled={(i === 1 || i === 3) && !valid.success} onClick={() => { setStep(i); setNow(new Date().toISOString()); }}><span>{i + 1}</span>{label}</PricingButton>)}</nav>
    <p className="sp-preview-note">Preview only · No live service edits, customer messages, or payments</p>
    {notice && <div role="status" className="sp-notice">{notice}</div>}
    <div className="sp-layout"><div>
      <section className="sp-template-bar" aria-label="Choose a service template"><label className="sp-template-select"><span>Service template</span><select value={Object.keys(samples).find(key => samples[key].id === service.id) ?? "blank"} onChange={e => applyTemplate(e.target.value)}><option value="blank">Start from scratch</option><option value="catering">Catering</option><option value="cart">Beverage cart</option><option value="cookies">Cookies</option><option value="impersonator">Impersonators</option><option value="entertainment">Event entertainment</option><option value="play">Soft play</option></select><small>Switch templates to see the form update. Sample prices are editable.</small></label></section>
      {step === 0 && <ServicePricingFields value={service} onChange={changeService} />}
      {step === 1 && valid.success && <ServiceRequestPricing service={valid.data} selection={selection} onChange={setSelection} promotions={promotions} now={now} onRequest={requestQuote} />}
      <div hidden={step !== 2}>{quoteLines.length > 0 ? <ServiceQuoteBuilder key={requestVersion} initialLines={quoteLines} selection={quoteSelection} promotions={promotions} history={history} onHistory={setHistory} /> : <section className="sp-card"><h2>Start with a customer request.</h2><p>Choose quantities and extras to bring the complete calculation into a quote.</p><PricingButton type="button" disabled={!valid.success} onClick={() => setStep(1)}>Try customer request</PricingButton></section>}</div>
      {step === 3 && <ServicePromotions service={service} promotions={promotions} onChange={setPromotions} />}
    {step === 0 && <details className="sp-card sp-disclosure" style={{ marginTop: 20 }}><summary>Preview buyer price</summary>{valid.success ? <><h2>{service.name}</h2><p className="sp-price">{priceLabel(valid.data)}</p><p>{service.inclusions}</p><PricingButton type="button" className="sp-primary" onClick={() => setStep(1)}>Try customer request</PricingButton></> : <p className="sp-note">Complete the service name, description, inclusions and pricing to see the buyer preview.</p>}</details>}{!loaded && <p>Loading preview…</p>}</div></div>
  </div>;
}
