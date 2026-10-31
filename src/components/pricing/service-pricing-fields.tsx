"use client";

import {createContext,useContext,useId,type ReactNode} from "react";
import type {ServiceFormIssue} from "@/lib/service-form-validation";
const Issues=createContext<ServiceFormIssue[]>([]);
const Group=createContext<string|undefined>(undefined);
const requiredLabels=new Set(["Service name","Description","What’s included","Booking increments","Item label","Package name","Exact inclusions","Quantity or coverage included","Information needed to quote","Menu name","Menu choices","Add-on name","Add-on description","Add-on pricing type"]);
import { Button, type ButtonProps } from "@/components/ui/button";

export function PricingButton(props: ButtonProps) {
  const primary = props.className?.includes("sp-primary") || Boolean(props["aria-current"]) || props["aria-pressed"] === true;
  return <Button {...props} variant={primary ? "default" : "secondary"} />;
}
import { pricingTypes, extraTypes, type BasePricing, type ServicePricing } from "@/lib/service-pricing";

export function Field({ label, children, hint, required=requiredLabels.has(label) }: { label: string; children: ReactNode; hint?: string; required?:boolean }) {
  const group=useContext(Group),issues=useContext(Issues),id=useId();
  const error=issues.find(issue=>issue.label===label&&issue.group===group);
  return <label className="sp-field" data-field-label={label} data-invalid={Boolean(error)} aria-invalid={Boolean(error)} aria-describedby={error?id:undefined}><span>{label}{required&&<span className="sp-required" aria-label="required"> *</span>}</span>{children}{hint && <small>{hint}</small>}{error&&<small id={id} className="sp-field-error">{error.message}</small>}</label>;
}
export function Money({ label, value, onChange, optional = false }: { label: string; value?: number; onChange: (value: number | undefined) => void; optional?: boolean }) {
  return <Field label={label} required={!optional}><div className="sp-money"><span>$</span><input aria-label={label} type="number" min="0" step="0.01" value={value === undefined ? "" : value / 100} placeholder="0.00" required={!optional} onChange={e => onChange(e.target.value === "" ? undefined : Math.round(Number(e.target.value) * 100))} /></div></Field>;
}
export function NumberField({ label, value, onChange, min = 1, step = 1, max }: { label: string; value?: number; onChange: (value: number | undefined) => void; min?: number; step?: number; max?: number }) {
  return <Field label={label} required={!label.includes("optional")}><input type="number" min={min} max={max} step={step} value={value ?? ""} onChange={e => onChange(e.target.value === "" ? undefined : Number(e.target.value))} /></Field>;
}
export function newBase(type: BasePricing["type"]): BasePricing {
  switch (type) {
    case "fixed": return { type, rate: 0 };
    case "hour": return { type, rate: 0, minimum: 1, increment: 1 };
    case "person": return { type, rate: 0, minimum: 1 };
    case "item": return { type, rate: 0, label: "", minimum: 1, increment: 1 };
    case "package": return { type, packages: [{ id: crypto.randomUUID(), name: "", price: 0, inclusions: "", coverage: "" }] };
    case "custom": return { type, questions: [""] };
  }
}

export function ServicePricingFields({ value, onChange, issues=[] }: { value: ServicePricing; onChange: (value: ServicePricing) => void; issues?:ServiceFormIssue[] }) {
  const b = value.base;
  const set = (patch: Partial<ServicePricing>) => onChange({ ...value, ...patch });
  const base = (patch: object) => set({ base: { ...b, ...patch } as BasePricing });
  return <Issues.Provider value={issues}><div className="sp-stack">
    <section className="sp-card">
      <p className="sp-eyebrow">Base offering</p><h2>How do you charge for this service?</h2>
      <div className="sp-type-grid">{Object.entries(pricingTypes).map(([type, label]) => <PricingButton type="button" aria-pressed={b.type === type} key={type} onClick={() => { if (b.type !== type) set({ base: newBase(type as BasePricing["type"]) }); }}>{label}</PricingButton>)}</div>
      <Field label="Service name"><input value={value.name} placeholder="Type service name here" onChange={e => set({ name: e.target.value })} /></Field>
      <Field label="Description" hint="At least 20 characters."><textarea value={value.description} placeholder="Describe your service here" onChange={e => set({ description: e.target.value })} /></Field>
      <Field label="What’s included"><textarea value={value.inclusions} placeholder="List what every booking includes" onChange={e => set({ inclusions: e.target.value })} /></Field>
      <div className="sp-fields">
        {"rate" in b && <Money label={b.type === "fixed" ? "Price per booking" : b.type === "hour" ? "Hourly rate" : b.type === "person" ? "Price per person" : "Price per item"} value={b.rate} onChange={rate => base({ rate })} />}
        {(b.type === "hour" || b.type === "person" || b.type === "item") && <NumberField label={b.type === "hour" ? "Minimum hours" : b.type === "person" ? "Minimum people" : "Minimum quantity"} value={b.minimum} min={b.type === "hour" ? 0.5 : 1} step={b.type === "hour" ? 0.5 : 1} onChange={minimum => base({ minimum })} />}
        {b.type === "hour" && <Field label="Booking increments"><select value={b.increment} onChange={e => base({ increment: Number(e.target.value) })}><option value={0.5}>30 minutes</option><option value={1}>One hour</option></select></Field>}
        {b.type === "person" && <NumberField label="Maximum people (optional)" value={b.maximum} onChange={maximum => base({ maximum })} />}
        {b.type === "item" && <><Field label="Item label"><input value={b.label} placeholder="Type item label here" onChange={e => base({ label: e.target.value })} /></Field><NumberField label="Order increments" value={b.increment} onChange={increment => base({ increment })} /></>}
      </div>
      {b.type === "package" && <div className="sp-stack">{b.packages.map((pkg, index) => {
        const update = (patch: object) => base({ packages: b.packages.map(p => p.id === pkg.id ? { ...p, ...patch } : p) });
        return <details className="sp-disclosure" data-pricing-group={`packages.${index}`} key={pkg.id} open><summary>{pkg.name || `Package ${index + 1}`}</summary><Group.Provider value={`packages.${index}`}><div className="sp-stack"><Field label="Package name"><input value={pkg.name} placeholder="Type package name here" onChange={e => update({ name: e.target.value })} /></Field><Money label="Package price" value={pkg.price} onChange={price => update({ price })} /><Field label="Exact inclusions"><textarea value={pkg.inclusions} onChange={e => update({ inclusions: e.target.value })} /></Field><Field label="Quantity or coverage included"><input value={pkg.coverage} placeholder="Describe the included coverage" onChange={e => update({ coverage: e.target.value })} /></Field><PricingButton type="button" className="sp-link" disabled={b.packages.length === 1} onClick={() => base({ packages: b.packages.filter(p => p.id !== pkg.id) })}>Remove package</PricingButton></div></Group.Provider></details>;
      })}<PricingButton type="button" onClick={() => base({ packages: [...b.packages, { id: crypto.randomUUID(), name: "", price: 0, inclusions: "", coverage: "" }] })}>+ Add package</PricingButton></div>}
      {b.type === "custom" && <><Money label="Minimum booking amount (optional)" value={b.minimum} optional onChange={minimum => base({ minimum })} /><Field label="Information needed to quote" hint="One question per line."><textarea value={b.questions.join("\n")} placeholder="What do you need to know about the request?" onChange={e => base({ questions: e.target.value.split("\n") })} /></Field></>}
      <p className="sp-note">{b.type === "hour" ? "Your hourly rate × minimum hours gives customers the lowest booking price." : b.type === "person" ? "Your price per person × minimum guest count gives customers the lowest booking price." : b.type === "item" ? "Your price per item × minimum quantity gives customers the lowest order price." : b.type === "package" ? "Each package price should cover everything in that package. Add-ons cost more." : b.type === "custom" ? "Customers send their details first. You then provide a quote for their request." : "This price covers everything listed in ‘What’s included.’ Add-ons cost more."}</p>
    </section>
    <section className="sp-card"><h2>Menu & choices</h2><p className="sp-note">List flavors, drinks or other included choices. Use add-ons below for anything that costs more.</p>
      {(value.menus ?? []).map((menu, index) => {
        const update = (patch: Partial<typeof menu>) => set({ menus: value.menus!.map(item => item.id === menu.id ? { ...item, ...patch } : item) });
        return <details className="sp-disclosure" data-pricing-group={`menus.${index}`} key={menu.id} open><summary>{menu.name || `Menu ${index + 1}`}</summary><Group.Provider value={`menus.${index}`}><div className="sp-stack">
          <Field label="Menu name" hint="Example: Flavors or Drink menu."><input value={menu.name} placeholder="Type menu name here" onChange={e => update({ name: e.target.value })} /></Field>
          <Field label="Menu description (optional)"><textarea value={menu.description ?? ""} placeholder="Describe these choices" onChange={e => update({ description: e.target.value })} /></Field>
          <Field label="Menu choices" hint="Enter one choice per line."><textarea value={menu.options.join("\n")} placeholder="Type your menu choices here" onChange={e => update({ options: e.target.value.split("\n") })} /></Field>
          <Field label="How customers use this menu"><select value={menu.selection} onChange={e => update({ selection: e.target.value as typeof menu.selection, required: e.target.value === "display" ? false : menu.required })}><option value="display">Display menu only</option><option value="single">Choose one option</option><option value="multiple">Choose multiple options</option></select></Field>
          {menu.selection !== "display" && <label className="sp-check"><input type="checkbox" checked={menu.required} onChange={e => update({ required: e.target.checked })} />Require a choice when requesting this service</label>}
          <PricingButton type="button" className="sp-link" onClick={() => set({ menus: value.menus!.filter(item => item.id !== menu.id) })}>Remove menu</PricingButton>
        </div></Group.Provider></details>;
      })}<PricingButton type="button" onClick={() => set({ menus: [...(value.menus ?? []), { id: crypto.randomUUID(), name: "", options: [], selection: "display", required: false }] })}>+ Add menu</PricingButton>
    </section>
    <section className="sp-card sp-addons"><h2>Add-ons</h2><p className="sp-note">Customers choose these. Delivery and other location-dependent charges should be clearly named.</p>
      {value.extras.map((extra, index) => {
        const update = (patch: object) => set({ extras: value.extras.map(e => e.id === extra.id ? { ...e, ...patch } : e) });
        return <details className="sp-disclosure" data-pricing-group={`extras.${index}`} key={extra.id} open={extra.id.startsWith("draft-")}><summary>{extra.name || `Add-on ${index + 1}`}<small>{extraTypes[extra.type]}</small></summary><Group.Provider value={`extras.${index}`}><div className="sp-stack"><div className="sp-fields"><Field label="Add-on name"><input value={extra.name} placeholder="Type add-on name here" onChange={e => update({ name: e.target.value })} /></Field><Field label="Add-on description"><input value={extra.description} placeholder="Describe this add-on" onChange={e => update({ description: e.target.value })} /></Field></div><div className="sp-fields"><Field label="Add-on pricing type"><select value={extra.type} onChange={e => update({ type: e.target.value })}>{Object.entries(extraTypes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>{extra.type !== "quoted" && <Money label="Add-on price" value={extra.rate} onChange={rate => update({ rate })} />}</div>
          {extra.type === "hour" && <label className="sp-check"><input type="checkbox" checked={extra.separateHours} onChange={e => update({ separateHours: e.target.checked })} />Customer selects separate hours</label>}
          {(extra.type === "person" || (extra.type === "hour" && !extra.separateHours)) && <p className="sp-note">Uses the request’s {extra.type === "person" ? "guest count" : "hours"}. Customers only enter it once.</p>}
          {!["flat", "quoted"].includes(extra.type) && <details className="sp-disclosure"><summary>Quantity limits</summary><div className="sp-fields"><NumberField label="Add-on minimum" value={extra.minimum} step={extra.type === "hour" ? 0.5 : 1} min={extra.type === "hour" ? 0.5 : 1} onChange={minimum => update({ minimum })} /><NumberField label="Add-on maximum (optional)" value={extra.maximum} onChange={maximum => update({ maximum })} /><NumberField label="Add-on quantity increment" value={extra.increment} step={extra.type === "hour" ? 0.5 : 1} min={extra.type === "hour" ? 0.5 : 1} onChange={increment => update({ increment })} /></div></details>}
          <label className="sp-check"><input type="checkbox" checked={extra.locationRequired} onChange={e => update({ locationRequired: e.target.checked })} />Requires event location</label><PricingButton type="button" className="sp-link" onClick={() => set({ extras: value.extras.filter(e => e.id !== extra.id) })}>Remove add-on</PricingButton>
        </div></Group.Provider></details>;
      })}<PricingButton type="button" onClick={() => set({ extras: [...value.extras, { id: `draft-${crypto.randomUUID()}`, name: "", description: "", type: "flat", rate: 0, minimum: 1, increment: 1, separateHours: false, locationRequired: false }] })}>+ Add add-on</PricingButton>
    </section>
  </div></Issues.Provider>;
}
