"use client";

import { useState } from "react";
import { upsertOfferingAction } from "@/app/actions/vendor";
import { LegacyOfferingSetupForm, type ExistingOffering } from "@/components/vendor/offering-setup-form";
import { ImageUploadField } from "@/components/ui/image-upload-field";
import { ValidatedForm, SubmitButton } from "@/components/ui/validated-form";
import { serviceTemplates } from "@/lib/service-templates";
import { readStructuredPricing, servicePricingSchema, promotionSchema, priceLabel, type ServicePricing, type Promotion } from "@/lib/service-pricing";
import { ServicePricingFields, PricingButton, Field } from "./service-pricing-fields";
import { ServicePromotions } from "./service-promotions";
import "./pricing-preview.css";

type Props = { businessId?: string; categories: { id: string; name: string }[]; eventCategories: { id: string; name: string }[]; offering?: ExistingOffering };
export function LiveOfferingSetupForm(props: Props) {
  const saved = readStructuredPricing(props.offering?.pricing);
  const [convert, setConvert] = useState(false);
  if (props.offering && !saved && !convert) return <><div className="mb-6 rounded-2xl border p-5"><p className="mb-3 text-sm text-muted-foreground">This service uses your previous pricing setup. Keep it as-is, or choose a pricing type in the new builder. Nothing changes until you save.</p><PricingButton type="button" onClick={() => setConvert(true)}>Set up structured pricing</PricingButton></div><LegacyOfferingSetupForm {...props} /></>;
  return <StructuredForm {...props} initial={saved ?? { ...serviceTemplates.blank, name: props.offering?.title ?? "", description: props.offering?.description ?? "" }} />;
}
function StructuredForm({ initial, offering, businessId, categories, eventCategories }: Props & { initial: ServicePricing }) {
  const [service, setService] = useState(initial);
  const [template, setTemplate] = useState("");
  const [confirmed, setConfirmed] = useState(true);
  const [promotions, setPromotions] = useState<Promotion[]>(() => Array.isArray(offering?.promotions) ? offering.promotions.flatMap(p => { const parsed = promotionSchema.safeParse(p); return parsed.success ? [parsed.data] : []; }) : []);
  const parsed = servicePricingSchema.safeParse(service);
  return <div className="sp-workspace" style={{ padding: 0, minHeight: 0 }}><ValidatedForm action={upsertOfferingAction} className="sp-stack">
    {offering && <input type="hidden" name="id" value={offering.id} />}
    <input type="hidden" name="businessId" value={businessId ?? ""} />
    {offering && <input type="hidden" name="slug" value={offering.slug} />}
    <input type="hidden" name="type" value={offering?.type ?? "SERVICE"} />
    <input type="hidden" name="title" value={service.name} />
    <input type="hidden" name="description" value={service.description} />
    <input type="hidden" name="pricingJson" value={JSON.stringify(service)} />
    <input type="hidden" name="promotionsJson" value={JSON.stringify(promotions)} />
    <section className="sp-template-bar"><Field label="Service template"><select value={template} onChange={e => { setTemplate(e.target.value); if (!e.target.value) return; const next = structuredClone(serviceTemplates[e.target.value]); next.id = initial.id; setService(next); setPromotions([]); setConfirmed(e.target.value === "blank"); }}><option value="">Choose a template</option>{[["blank", "Start from scratch"], ["catering", "Catering"], ["cart", "Beverage cart"], ["cookies", "Cookies"], ["impersonator", "Impersonators"], ["entertainment", "Event entertainment"], ["play", "Soft play"]].map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></Field></section>
    <ServicePricingFields value={service} onChange={setService} />
    {!confirmed && <label className="sp-check"><input type="checkbox" onChange={e => setConfirmed(e.target.checked)} />I have reviewed the template’s sample prices and inclusions and set them for my business.</label>}
    <details className="sp-card"><summary>Photos & categories</summary><div className="sp-stack"><div className="sp-fields"><ImageUploadField name="photos" label="Cover photo" defaultValue={offering?.photos[0]} defaultCrop={offering?.photoCrops?.[0]} /><ImageUploadField name="photos" label="Detail photo" defaultValue={offering?.photos[1]} defaultCrop={offering?.photoCrops?.[1]} /></div>{offering?.photos.slice(2).map((photo, i) => <span key={i}><input type="hidden" name="photos" value={photo} /><input type="hidden" name="photosCrop" value={JSON.stringify(offering.photoCrops?.[i + 2] ?? null)} /></span>)}<fieldset><legend>Service categories</legend>{categories.map(category => <label className="sp-check" key={category.id}><input type="checkbox" name="categoryIds" value={category.id} defaultChecked={(offering?.categoryIds ?? [offering?.categoryId]).includes(category.id)} />{category.name}</label>)}</fieldset><details><summary>Event types (optional)</summary>{eventCategories.map(category => <label className="sp-check" key={category.id}><input type="checkbox" name="eventCategoryIds" value={category.id} defaultChecked={offering?.eventCategoryIds.includes(category.id)} />{category.name}</label>)}</details></div></details>
    <details className="sp-card"><summary>Promotions (optional)</summary><ServicePromotions service={service} promotions={promotions} onChange={setPromotions} live /></details>
    {parsed.success ? <p className="sp-note">Customers see: {priceLabel(parsed.data)}</p> : <p className="sp-note">Complete the service name, description, inclusions and pricing before saving.</p>}
    <SubmitButton disabled={!parsed.success || !confirmed} pendingText="Saving service…">{offering ? "Save service" : "Create service"}</SubmitButton>
  </ValidatedForm></div>;
}
