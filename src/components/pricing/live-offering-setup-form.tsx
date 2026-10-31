"use client";

import { useRef, useState } from "react";
import { upsertOfferingAction } from "@/app/actions/vendor";
import { LegacyOfferingSetupForm, type ExistingOffering } from "@/components/vendor/offering-setup-form";
import { ImageUploadField } from "@/components/ui/image-upload-field";
import { SubmitButton } from "@/components/ui/validated-form";
import { serviceFormIssues, type ServiceFormIssue } from "@/lib/service-form-validation";
import { serviceTemplates } from "@/lib/service-templates";
import { readStructuredPricing, servicePricingSchema, promotionSchema, priceLabel, type ServicePricing, type Promotion } from "@/lib/service-pricing";
import { ServicePricingFields, PricingButton, Field } from "./service-pricing-fields";

import "./pricing-preview.css";

type Props = { onSaved?:()=>void; previewOnly?:boolean; businessId?: string; categories: { id: string; name: string }[]; eventCategories: { id: string; name: string }[]; offering?: ExistingOffering };
export function LiveOfferingSetupForm(props: Props) {
  const saved = readStructuredPricing(props.offering?.pricing);
  const [convert, setConvert] = useState(false);
  if (props.offering && !saved && !convert) return <><div className="mb-6 rounded-2xl border p-5"><p className="mb-3 text-sm text-muted-foreground">This service uses your previous pricing setup. Keep it as-is, or choose a pricing type in the new builder. Nothing changes until you save.</p><PricingButton type="button" onClick={() => setConvert(true)}>Set up structured pricing</PricingButton></div><LegacyOfferingSetupForm {...props} /></>;
  return <StructuredForm {...props} initial={saved ?? { ...serviceTemplates.blank, name: props.offering?.title ?? "", description: props.offering?.description ?? "" }} />;
}
function StructuredForm({ initial, offering, businessId, categories, eventCategories, onSaved, previewOnly }: Props & { initial: ServicePricing }) {
  const [saveError,setSaveError]=useState<string|null>(null);
  const [service, setService] = useState(initial);
  const [template, setTemplate] = useState("");
  const [confirmed, setConfirmed] = useState(true);
  const [attempted, setAttempted] = useState(false);
  const [categoryIds, setCategoryIds] = useState<string[]>(offering?.categoryIds ?? (offering?.categoryId ? [offering.categoryId] : []));
  const [eventIds, setEventIds] = useState<string[]>(offering?.eventCategoryIds ?? []);
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const issues = serviceFormIssues(service, categoryIds, confirmed, eventIds.length);
  function focusIssue(issue: ServiceFormIssue) {
    const form = formRef.current;
    if (!form) return;
    const scope = issue.group ? Array.from(form.querySelectorAll<HTMLElement>("[data-pricing-group]")).find(el => el.dataset.pricingGroup === issue.group) ?? form : form;
    const field = Array.from(scope.querySelectorAll<HTMLElement>("[data-field-label]")).find(el => el.dataset.fieldLabel === issue.label) ?? scope;
    let parent: HTMLElement | null = field;
    while (parent && parent !== form) { if (parent instanceof HTMLDetailsElement) parent.open = true; parent = parent.parentElement; }
    const input = field.querySelector<HTMLElement>("input, textarea, select, summary");
    input?.focus(); field.scrollIntoView({ block: "center", behavior: "smooth" });
  }
  const [promotions] = useState<Promotion[]>(() => Array.isArray(offering?.promotions) ? offering.promotions.flatMap(p => { const parsed = promotionSchema.safeParse(p); return parsed.success ? [parsed.data] : []; }) : []);
  const parsed = servicePricingSchema.safeParse(service);
  return <div className="sp-workspace" style={{ padding: 0, minHeight: 0 }}><form ref={formRef} noValidate action={async data=>{if(previewOnly){setSaveError("This is a preview. Open your storefront editor to save a service.");return;}try{if(onSaved)data.set("stayInStorefront","1");await upsertOfferingAction(data);onSaved?.();}catch(error){if(!onSaved)throw error;setSaveError(error instanceof Error&&!error.message.includes("NEXT_REDIRECT")?error.message:"The service could not be saved. Check the fields and try again. Your entries are kept.");}}} className="sp-stack" onSubmit={event => {
    if (!issues.length) return;
    event.preventDefault(); setAttempted(true);
    focusIssue(issues[0]);
    requestAnimationFrame(() => { errorRef.current?.focus(); errorRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }); });
  }}>
    {saveError&&<p role="alert" className="sp-card">{saveError}</p>}
    {offering && <input type="hidden" name="id" value={offering.id} />}
    <input type="hidden" name="businessId" value={businessId ?? ""} />
    {offering && <input type="hidden" name="slug" value={offering.slug} />}
    <input type="hidden" name="type" value={offering?.type ?? "SERVICE"} />
    <input type="hidden" name="title" value={service.name} />
    <input type="hidden" name="description" value={service.description} />
    <input type="hidden" name="pricingJson" value={JSON.stringify(service)} />
    <input type="hidden" name="promotionsJson" value={JSON.stringify(promotions)} />
    <section className="sp-template-bar"><Field label="Service template"><select value={template} onChange={e => { setTemplate(e.target.value); if (!e.target.value) return; const next = structuredClone(serviceTemplates[e.target.value]); next.id = initial.id; next.extras=[]; setService(next); setConfirmed(e.target.value === "blank"); }}><option value="" disabled>Choose a template</option>{[["blank", "Start from scratch"], ["catering", "Catering"], ["cart", "Beverage cart"], ["cookies", "Cookies"], ["impersonator", "Impersonators"], ["entertainment", "Event entertainment"], ["play", "Soft play"]].map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></Field></section>
    {attempted && issues.length > 0 && <div ref={errorRef} tabIndex={-1} role="alert" className="sp-card sp-save-errors"><h2>Before you save</h2><p>Finish these fields. Select a message to go directly to it.</p><ul>{issues.map((issue, i) => <li key={`${issue.group}-${issue.label}-${i}`}><button type="button" className="sp-link" onClick={() => focusIssue(issue)}>{issue.message}</button></li>)}</ul></div>}
    <p className="sp-note"><span className="sp-required">*</span> Required fields</p><ServicePricingFields value={service} onChange={setService} issues={attempted?issues:[]} />

    <details className="sp-card" open={attempted&&issues.some(issue=>issue.label==="Service categories")?true:undefined}><summary>Photos & categories <span className="sp-required" aria-label="required">*</span></summary><div className="sp-stack"><div className="sp-fields"><ImageUploadField name="photos" label="Cover photo" defaultValue={offering?.photos[0]} defaultCrop={offering?.photoCrops?.[0]} /><ImageUploadField name="photos" label="Detail photo" defaultValue={offering?.photos[1]} defaultCrop={offering?.photoCrops?.[1]} /></div>{offering?.photos.slice(2).map((photo, i) => <span key={i}><input type="hidden" name="photos" value={photo} /><input type="hidden" name="photosCrop" value={JSON.stringify(offering.photoCrops?.[i + 2] ?? null)} /></span>)}<fieldset data-field-label="Service categories" data-invalid={attempted&&!categoryIds.length}><legend>Service categories <span className="sp-required" aria-label="required">*</span></legend>{attempted&&!categoryIds.length&&<p className="sp-field-error">Choose at least one service category.</p>}{categories.map(category => <label className="sp-check" key={category.id}><input type="checkbox" name="categoryIds" value={category.id} checked={categoryIds.includes(category.id)} onChange={e => setCategoryIds(e.target.checked ? [...categoryIds, category.id] : categoryIds.filter(id => id !== category.id))} />{category.name}</label>)}</fieldset><details data-field-label="Event types"><summary>Event types (optional)</summary>{eventCategories.map(category => <label className="sp-check" key={category.id}><input type="checkbox" name="eventCategoryIds" value={category.id} checked={eventIds.includes(category.id)} onChange={e => setEventIds(e.target.checked ? [...eventIds, category.id] : eventIds.filter(id => id !== category.id))} />{category.name}</label>)}</details></div></details>

    {parsed.success ? <p className="sp-note">Customers see: {priceLabel(parsed.data)}</p> : <p className="sp-note">Complete the service name, description, inclusions and pricing before saving.</p>}
<div className="sp-save-area">    {template && template !== "blank" && <label className="sp-check" data-invalid={attempted&&!confirmed} data-field-label="Template review"><input type="checkbox" aria-required="true" aria-invalid={attempted&&!confirmed} checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /><span><span className="sp-required">* </span>I have reviewed the template’s sample prices and inclusions and set them for my business.</span></label>}
    <SubmitButton pendingText="Saving service…">{offering ? "Save service" : "Create service"}</SubmitButton></div>
  </form></div>;
}
