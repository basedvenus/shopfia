"use client";
import { useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, X } from "lucide-react";
import { createUnclaimedVendorAction } from "@/app/actions/vendor";
import { UNCLAIMED_VENDOR_CATEGORIES, VENDOR_BOOKING_CHANNELS } from "@/lib/unclaimed-vendor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { type VendorOption } from "@/components/parties/party-event-form";

export function UnclaimedVendorModal({ initialName, onClose, onCreated }: { initialName: string; onClose: () => void; onCreated: (vendor: VendorOption) => void }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState(initialName);
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [bookingChannel, setBookingChannel] = useState("");
  const [bookingDetails, setBookingDetails] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  function next() {
    setError("");
    if (step === 1 && (name.trim().length < 2 || city.trim().length < 2)) { setError("Add the business name and city to continue."); return; }
    if (step === 2 && !categories.length) { setError("Choose at least one vendor type."); return; }
    setStep((current) => current + 1);
  }
  const needsBookingDetails = bookingChannel === "Other" || bookingChannel === "Website or booking form";
  const bookingDetailsLabel = bookingChannel === "Other" ? "How did you book them?" : bookingChannel === "Website or booking form" ? "Which website or booking form did you use?" : "Booking contact or notes (optional)";
  const bookingDetailsPlaceholder = bookingChannel === "Other" ? "Describe how you found and booked the business." : bookingChannel === "Website or booking form" ? "Paste the website or booking page link, or enter its name." : "The email, number, or contact you used to book the business.";
  return <Dialog.Root open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm" />
      <Dialog.Content className="fixed left-1/2 top-1/2 z-[91] flex max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl border bg-[#fffaf7] shadow-xl outline-none" onKeyDown={(event) => { if (event.key === "Enter" && event.target instanceof HTMLInputElement) { event.preventDefault(); if (step < 3) next(); } }}>
        <div className="border-b p-5 pr-16"><p className="text-xs font-semibold uppercase tracking-widest text-primary">Unclaimed vendor · Step {step} of 3</p><Dialog.Title className="mt-2 text-2xl font-semibold">{step === 1 ? "Who helped with your party?" : step === 2 ? "What do they offer?" : "How did you book them?"}</Dialog.Title><Dialog.Description className="mt-2 text-sm text-muted-foreground">{step === 1 ? "Add the business name and the city where they’re based." : step === 2 ? "Choose the services they provided. You can select more than one." : "Public business links help people find the right vendor. Your booking details stay private."}</Dialog.Description></div>
        <Dialog.Close aria-label="Close add vendor" disabled={pending} className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white"><X className="h-5 w-5" /></Dialog.Close>
        <div className="grid gap-4 overflow-y-auto p-5">
          {step === 1 ? <>
            <label className="grid gap-2 text-sm font-medium">Vendor name<Input autoFocus value={name} maxLength={120} onChange={(event) => setName(event.target.value)} /></label>
            <label className="grid gap-2 text-sm font-medium">Vendor city<Input value={city} maxLength={80} onChange={(event) => setCity(event.target.value)} placeholder="e.g. Fairfield" /></label>
            <label className="grid gap-2 text-sm font-medium">State or region (optional)<Input value={state} maxLength={40} onChange={(event) => setState(event.target.value)} placeholder="e.g. California" /></label>
          </> : step === 2 ? <fieldset className="grid gap-2"><legend className="mb-3 text-sm font-medium">Vendor type</legend>{UNCLAIMED_VENDOR_CATEGORIES.map((category) => <label key={category} className="flex items-center gap-3 rounded-xl border bg-white px-3 py-2 text-sm"><input type="checkbox" checked={categories.includes(category)} onChange={(event) => setCategories((current) => event.target.checked ? [...current, category] : current.filter((value) => value !== category))} />{category}</label>)}</fieldset> : <>
            <label className="grid gap-2 text-sm font-medium">How did you contact or book them?<select value={bookingChannel} onChange={(event) => setBookingChannel(event.target.value)} className="h-12 rounded-xl border bg-white px-3"><option value="">Choose a method</option>{VENDOR_BOOKING_CHANNELS.map((channel) => <option key={channel} value={channel}>{channel}</option>)}</select></label>
            <label className="grid gap-2 text-sm font-medium">{bookingDetailsLabel}<Textarea required={needsBookingDetails} value={bookingDetails} maxLength={500} onChange={(event) => setBookingDetails(event.target.value)} placeholder={bookingDetailsPlaceholder} /><span className="text-xs font-normal text-muted-foreground">Private to you and ShopFia; never shown on the public profile.</span></label>
            <label className="grid gap-2 text-sm font-medium">Public business Instagram (optional)<Input value={instagramHandle} maxLength={80} onChange={(event) => setInstagramHandle(event.target.value)} placeholder="@businessname" /></label>
            <label className="grid gap-2 text-sm font-medium">Public business website (optional)<Input value={website} maxLength={255} onChange={(event) => setWebsite(event.target.value)} placeholder="business.com" /></label>
          </>}
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        </div>
        <div className="flex justify-end gap-2 border-t bg-white p-5">
          {step > 1 ? <Button type="button" variant="secondary" disabled={pending} onClick={() => { setError(""); setStep((current) => current - 1); }}>Back</Button> : <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>}
          {step < 3 ? <Button type="button" onClick={next}>Next</Button> : <Button type="button" disabled={pending} onClick={() => {
            setError("");
            if (!bookingChannel) { setError("Choose how you contacted or booked the vendor."); return; }
            if (needsBookingDetails && bookingDetails.trim().length < 2) { setError(bookingChannel === "Other" ? "Tell us how you booked this vendor." : "Add the website or booking form you used."); return; }
            startTransition(async () => {
              try {
                const result = await createUnclaimedVendorAction({ name, city, state, categories, bookingChannel, bookingDetails, instagramHandle, website });
                if (!result.ok || !result.vendor) setError(result.error ?? "Could not add this vendor.");
                else onCreated(result.vendor);
              } catch { setError("Could not save the vendor. Your details are still here; please try again."); }
            });
          }}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{pending ? "Saving…" : "Add vendor & tag photo"}</Button>}
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
