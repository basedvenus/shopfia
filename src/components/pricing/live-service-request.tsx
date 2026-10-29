"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPublicInquiryAction } from "@/app/actions/inquiries";
import { initialSelection, promotionSchema, type ServicePricing } from "@/lib/service-pricing";
import { ServiceRequestPricing } from "./service-request-pricing";
import { Field } from "./service-pricing-fields";
import "./pricing-preview.css";

export function LiveServiceRequest({ pricing, promotions, offeringId, vendorId, defaultName }: { pricing: ServicePricing; promotions: unknown; offeringId: string; vendorId: string; defaultName: string }) {
  const router = useRouter();
  const [selection, setSelection] = useState(initialSelection(pricing));
  const [name, setName] = useState(defaultName);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const available = Array.isArray(promotions) ? promotions.flatMap(p => { const parsed = promotionSchema.safeParse(p); return parsed.success ? [parsed.data] : []; }) : [];
  async function send() {
    if (pending) return;
    setPending(true); setError("");
    const form = new FormData();
    form.set("vendorProfileId", vendorId); form.set("offeringId", offeringId); form.set("name", name);
    form.set("eventDate", selection.eventDate); form.set("eventLocation", selection.location);
    form.set("message", message.trim() || `Request for ${pricing.name}`); form.set("pricingSelection", JSON.stringify(selection));
    try { const result = await createPublicInquiryAction(form); if (result.requiresAuth) router.push(`/account?redirectTo=${encodeURIComponent(`/offering/${offeringId}`)}`); else if (result.success) router.push(`/messages?conversationId=${result.conversationId}`); else setError(result.error ?? "Could not send your request."); } catch { setError("Could not send your request. Please try again."); } finally { setPending(false); }
  }
  return <div id="inquiry" className="sp-workspace" style={{ padding: 0, minHeight: 0 }}><div className="sp-stack"><Field label="Your name"><input value={name} onChange={e => setName(e.target.value)} placeholder="Type your name here" /></Field><Field label="Message (optional)"><textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Share any other details" /></Field><ServiceRequestPricing service={pricing} selection={selection} onChange={setSelection} promotions={available} now={new Date().toISOString()} onRequest={send} requestLabel={pending ? "Sending request…" : "Send request"} disabled={pending} />{error && <p role="alert" className="sp-errors">{error}</p>}</div></div>;
}
