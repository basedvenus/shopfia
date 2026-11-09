"use client";
import {PlaceAutocompleteInput} from "@/components/location/place-autocomplete-input";
import {ImageUploadField} from "@/components/ui/image-upload-field";
import {Heart} from "lucide-react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPublicInquiryAction } from "@/app/actions/inquiries";
import { initialSelection, promotionSchema, type ServicePricing } from "@/lib/service-pricing";
import { ServiceRequestPricing } from "./service-request-pricing";
import { Field } from "./service-pricing-fields";
import "./pricing-preview.css";

export function LiveServiceRequest({ pricing, promotions, offeringId, vendorId, defaultName }: { pricing: ServicePricing; promotions: unknown; offeringId: string; vendorId: string; defaultName: string }) {
  const router = useRouter();
  const formRef=useRef<HTMLFormElement>(null);
  const [budget,setBudget]=useState("");
  const [selection, setSelection] = useState(initialSelection(pricing));
  const [name, setName] = useState(defaultName);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const available = Array.isArray(promotions) ? promotions.flatMap(p => { const parsed = promotionSchema.safeParse(p); return parsed.success ? [parsed.data] : []; }) : [];
  async function send() {
    if (pending) return;
    if(!selection.eventDate){setError("Choose an event date before sending your inquiry.");return;}
    setPending(true); setError("");
    const form = new FormData(formRef.current??undefined);
    form.set("budgetDollars",budget);
    form.set("guestCount",String(pricing.base.type==="person"?selection.quantity??"":selection.guests??""));
    form.set("vendorProfileId", vendorId); form.set("offeringId", offeringId); form.set("name", name);
    form.set("eventDate", selection.eventDate); form.set("eventLocation", selection.location);
    form.set("message", message.trim() || `Request for ${pricing.name}`); form.set("pricingSelection", JSON.stringify(selection));
    try { const result = await createPublicInquiryAction(form); if (result.requiresAuth) router.push(`/account?redirectTo=${encodeURIComponent(`/offering/${offeringId}`)}`); else if (result.success) router.push(`/messages?conversationId=${result.conversationId}`); else setError(result.error ?? "Could not send your request."); } catch { setError("Could not send your request. Please try again."); } finally { setPending(false); }
  }
  return <div id="inquiry" className="sp-workspace sp-live-request"><form ref={formRef} onSubmit={event=>{event.preventDefault();void send();}} className="sp-inquiry-card"><header className="mb-6 space-y-2"><p className="font-serif italic text-primary text-xl">Let’s connect</p><h2 className="flex items-center gap-3 font-serif text-3xl">Send inquiry <Heart className="h-5 w-5 text-primary"/></h2><p className="text-sm text-muted-foreground">Share what you are planning and this vendor can reply inside ShopFia messages.</p></header><div className="mt-5"><ServiceRequestPricing inquiryLayout service={pricing} selection={selection} onChange={setSelection} promotions={available} now={new Date().toISOString()} onRequest={send} requestLabel={pending ? "Sending inquiry…" : "Send inquiry"} disabled={pending} detailsFields={<section className="sp-stack pt-5"><h3>Details</h3><Field label="Your name" required><input autoComplete="name" value={name} onChange={e => setName(e.target.value)} placeholder="Type your name here" /></Field><div className="sp-fields"><Field label="Budget (optional)"><input type="number" min={0} step="0.01" placeholder="e.g. 500" value={budget} onChange={e=>setBudget(e.target.value)}/></Field>{pricing.base.type!=="person"&&<Field label="Guest count (optional)"><input type="number" min={1} placeholder="e.g. 20 guests" value={selection.guests??""} onChange={e=>setSelection({...selection,guests:e.target.value?Number(e.target.value):undefined})}/></Field>}</div><div className="sp-fields"><Field label="Event date" required><input required type="date" value={selection.eventDate} onChange={e=>setSelection({...selection,eventDate:e.target.value})}/></Field><Field label="Event location (optional)"><div className="sp-location-search"><PlaceAutocompleteInput placeholder="Search address or venue" defaultValue={selection.location} fieldNames={{input:"pricingEventLocation"}} omitHiddenFields requireSelection onPlaceSelect={place=>setSelection({...selection,location:place.formattedAddress})}/></div></Field></div></section>} contactFields={<><section className="sp-card"><h3>Add inspiration</h3><ImageUploadField compact hideFormatDetailsUntilInteraction name="inspirationUrls" label="" uploadLabel="Add inspiration photos"/><Field label="Inspiration link (optional)"><input name="inspirationUrls" type="url" placeholder="Add a Pinterest link"/></Field></section><section className="sp-card"><h3>Message for the vendor</h3><p className="sp-note">Tell the vendor what you’re envisioning.</p><textarea aria-label="Message for the vendor" value={message} onChange={e=>setMessage(e.target.value)} placeholder="Share your vision, style, timing, must-haves, or any other details…"/>{error&&<p role="alert" className="sp-errors">{error}</p>}</section></>} /></div><p className="mt-4 text-xs text-muted-foreground">Your message stays private and is only shared with this vendor.</p></form></div>;
}
