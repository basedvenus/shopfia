"use client";
import {CategoryTemplateSelect} from "./category-template-select";
import {ServiceCategoryPicker,eventTypeOptions} from "@/components/vendor/service-category-picker";

import { useRef, useState } from "react";
import { upsertOfferingAction } from "@/app/actions/vendor";
import { LegacyOfferingSetupForm, type ExistingOffering } from "@/components/vendor/offering-setup-form";
import { ServicePhotoGrid } from "@/components/vendor/service-photo-grid";
import { SubmitButton } from "@/components/ui/validated-form";
import { serviceFormIssues, type ServiceFormIssue } from "@/lib/service-form-validation";
import { serviceTemplates } from "@/lib/service-templates";
import { readStructuredPricing, servicePricingSchema, promotionSchema, priceLabel, type ServicePricing, type Promotion } from "@/lib/service-pricing";
import { ServicePricingFields, PricingButton, Field } from "./service-pricing-fields";

import "./pricing-preview.css";

type Props = { defaultCategoryIds?:string[]; onSaved?:()=>void; previewOnly?:boolean; businessId?: string; categories: { id: string; name: string }[]; eventCategories: { id: string; name: string }[]; offering?: ExistingOffering };
export function LiveOfferingSetupForm(props: Props) {
  const saved = readStructuredPricing(props.offering?.pricing);
  const [convert, setConvert] = useState(false);
  if (props.offering && !saved && !convert) return <><div className="mb-6 rounded-2xl border p-5"><p className="mb-3 text-sm text-muted-foreground">This service uses your previous pricing setup. Keep it as-is, or choose a pricing type in the new builder. Nothing changes until you save.</p><PricingButton type="button" onClick={() => setConvert(true)}>Set up structured pricing</PricingButton></div><LegacyOfferingSetupForm {...props} /></>;
  return <StructuredForm {...props} initial={saved ?? { ...serviceTemplates.blank, name: props.offering?.title ?? "", description: props.offering?.description ?? "" }} />;
}
function StructuredForm({ initial, offering, businessId, categories, eventCategories, defaultCategoryIds, onSaved, previewOnly }: Props & { initial: ServicePricing }) {
  const steps=[{id:"basics",label:"Details & pricing",hint:"Describe what you offer and set your price."},{id:"options",label:"Options & menus",hint:"Optional: add flavors, styles, or other included choices."},{id:"addons",label:"Add-ons",hint:"Optional: add extras that cost more."},{id:"photos",label:"Photos",hint:"Show your service. Drag your preferred cover photo to the front."},{id:"categories",label:"Categories",hint:"Choose where customers can find this service, then save."}];
  const [step,setStep]=useState(0);
  function goToStep(index:number){setStep(index);requestAnimationFrame(()=>formRef.current?.querySelector<HTMLElement>("[data-step-heading]")?.focus());}
  const [saveError,setSaveError]=useState<string|null>(null);
  const [service, setService] = useState(initial);
  const [template, setTemplate] = useState("");
  const [confirmed, setConfirmed] = useState(true);
  const [attempted, setAttempted] = useState(false);
  const [categoryIds, setCategoryIds] = useState<string[]>(offering?.categoryIds ?? (offering?.categoryId ? [offering.categoryId] : (defaultCategoryIds??[])));
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
    const section=field.closest("section[id^=service-]")?.id.replace("service-","");
    const targetStep=steps.findIndex(item=>item.id===section);
    if(targetStep>=0)setStep(targetStep);
    requestAnimationFrame(()=>{
    const input = field.querySelector<HTMLElement>("input, textarea, select, summary");
    input?.focus(); field.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }
  const [promotions] = useState<Promotion[]>(() => Array.isArray(offering?.promotions) ? offering.promotions.flatMap(p => { const parsed = promotionSchema.safeParse(p); return parsed.success ? [parsed.data] : []; }) : []);
  const parsed = servicePricingSchema.safeParse(service);
  return <div className="sp-workspace sp-live-form" style={{ padding: 0, minHeight: 0 }}><form ref={formRef} noValidate action={async data=>{if(previewOnly){setSaveError("This is a preview. Open your storefront editor to save a service.");return;}try{if(onSaved)data.set("stayInStorefront","1");await upsertOfferingAction(data);onSaved?.();}catch(error){if(!onSaved)throw error;setSaveError(error instanceof Error&&!error.message.includes("NEXT_REDIRECT")?error.message:"The service could not be saved. Check the fields and try again. Your entries are kept.");}}} className="sp-stack" onSubmit={event => {
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
    <nav aria-label="Service setup steps" className="sp-step-nav">{steps.map((item,index)=><PricingButton key={item.id} type="button" aria-current={step===index?"step":undefined} onClick={()=>goToStep(index)}>{index+1}. {item.label}</PricingButton>)}</nav>
    <div><p className="sp-note">Step {step+1} of {steps.length}</p><h2 data-step-heading tabIndex={-1}>{steps[step].label}</h2><p className="sp-note">{steps[step].hint}</p></div>
    <section hidden={step!==0} className="sp-template-bar"><p className="font-semibold">Start with a category template</p><p className="sp-note">Choose your category for an editable starting point, or start from scratch. Applying a template replaces the current service details.</p><CategoryTemplateSelect value={template} options={categories} onChange={id=>{setTemplate(id);const category=categories.find(item=>item.id===id);const name=category?.name.toLowerCase()??"";const key=/cater|food/.test(name)?"catering":/beverage|drink/.test(name)?"cart":/bake|dessert/.test(name)?"cookies":/rental/.test(name)?"rentals":/entertain|perform/.test(name)?"entertainment":"blank";const next=structuredClone(serviceTemplates[key]);next.id=initial.id;next.name="";next.description="";next.inclusions="";next.extras=[];if("rate" in next.base)next.base.rate=0;if(next.base.type==="package")next.base.packages=next.base.packages.map(pkg=>({...pkg,id:crypto.randomUUID(),price:0,inclusions:""}));setService(next);setConfirmed(true);if(category)setCategoryIds([category.id]);}}/></section>
    {attempted && issues.length > 0 && <div ref={errorRef} tabIndex={-1} role="alert" className="sp-card sp-save-errors"><h2>Before you save</h2><p>Finish these fields. Select a message to go directly to it.</p><ul>{issues.map((issue, i) => <li key={`${issue.group}-${issue.label}-${i}`}><button type="button" className="sp-link" onClick={() => focusIssue(issue)}>{issue.message}</button></li>)}</ul></div>}
    <p className="sp-note"><span className="sp-required">*</span> Required fields</p><ServicePricingFields activeSection={steps[step].id} businessId={businessId} previewOnly={previewOnly} value={service} onChange={setService} issues={attempted?issues:[]} />

    <section hidden={step!==3} id="service-photos" className="sp-card scroll-mt-28"><ServicePhotoGrid businessId={businessId} previewOnly={previewOnly} photos={offering?.photos} crops={offering?.photoCrops}/></section>
    <section hidden={step!==4} id="service-categories" className="sp-card scroll-mt-28"><div className="sp-stack">{!offering&&defaultCategoryIds?.length?<p className="sp-note">Your business categories are selected. Add or remove categories for this service.</p>:null}<ServiceCategoryPicker label="Service categories" name="categoryIds" options={categories} selected={categoryIds} onChange={setCategoryIds} required error={attempted&&!categoryIds.length?"Choose at least one service category.":undefined}/><ServiceCategoryPicker label="Event types" name="eventCategoryIds" options={eventTypeOptions(eventCategories).sort((a,b)=>a.name.localeCompare(b.name))} selected={eventIds} onChange={setEventIds}/></div></section>

    {parsed.success ? <p className="sp-note">Customers see: {priceLabel(parsed.data)}</p> : <p className="sp-note">Complete the service name, description, inclusions and pricing before saving.</p>}
<div className="sp-save-area" hidden={step!==4}>    {template && template !== "blank" && <label className="sp-check" data-invalid={attempted&&!confirmed} data-field-label="Template review"><input type="checkbox" aria-required="true" aria-invalid={attempted&&!confirmed} checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /><span><span className="sp-required">* </span>I have reviewed the template’s sample prices and inclusions and set them for my business.</span></label>}
    <SubmitButton pendingText="Saving service…">{offering ? "Save service" : "Create service"}</SubmitButton></div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><PricingButton type="button" disabled={step===0} onClick={()=>goToStep(step-1)}>Back</PricingButton>{step<4&&<PricingButton className="sp-primary" type="button" onClick={()=>goToStep(step+1)}>{step===1||step===2?"Continue (or skip)":"Continue"} →</PricingButton>}<p className="sp-note">Your changes are saved when you {offering?"save":"create"} the service.</p></div>
  </form></div>;
}
