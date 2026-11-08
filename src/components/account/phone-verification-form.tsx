"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { ShieldCheck, Smartphone, X } from "lucide-react";
import { sendPhoneCodeAction, confirmPhoneCodeAction } from "@/app/actions/phone-verification";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PhoneVerificationForm({ verifiedPhone, configured }: {verifiedPhone: string | null; configured: boolean}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function changeOpen(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (next) { setSent(false); setPhone(""); setMessage(""); setError(""); }
  }

  async function sendCode() {
    setPending(true); setError(""); setMessage("");
    const form = new FormData(); form.set("phone", phone); form.set("consent", "on");
    try {
      const result = await sendPhoneCodeAction(form);
      if (!result.ok) setError(result.error ?? "Please try again.");
      else { setSent(true); setMessage("Code sent. It expires in 10 minutes."); }
    } catch { setError("Could not send a code. Please try again."); }
    finally { setPending(false); }
  }

  return <section id="phone-verification" className="mt-5 border-t pt-5">
    <div className="flex items-center gap-2"><Smartphone className="h-5 w-5 text-primary" /><h2 className="text-sm font-medium">Phone number</h2></div>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">Confirm your phone number with a text message code.</p>
    <Dialog.Root open={open} onOpenChange={changeOpen}>
      {verifiedPhone ? <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><ShieldCheck className="h-5 w-5" /><span className="flex-1">Mobile number · {verifiedPhone}</span><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold">Verified</span>{configured ? <Dialog.Trigger asChild><button type="button" className="underline">Change number</button></Dialog.Trigger> : null}</div>
        : configured ? <Dialog.Trigger asChild><Button type="button" className="mt-4">Verify phone number</Button></Dialog.Trigger> : null}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/35 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[28px] border border-rose-100 bg-white p-6 shadow-2xl sm:p-8" onEscapeKeyDown={event => { if (pending) event.preventDefault(); }} onPointerDownOutside={event => { if (pending) event.preventDefault(); }}>
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50"><Smartphone className="h-5 w-5 text-primary" /></div>
          <Dialog.Title className="pr-8 text-2xl font-semibold tracking-tight">{sent ? "Enter your verification code" : "Verify your phone number"}</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">{sent ? `Enter the six-digit code we texted to ${phone}.` : "We’ll text you a six-digit code to confirm this number belongs to you."}</Dialog.Description>
          <Dialog.Close asChild><button type="button" aria-label="Close phone verification" disabled={pending} className="absolute right-5 top-5 rounded-full p-2 text-muted-foreground hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"><X className="h-5 w-5" /></button></Dialog.Close>
          {!sent ? <form className="mt-5 grid gap-4" onSubmit={event => {event.preventDefault(); void sendCode();}}>
            <label className="grid gap-2 text-sm font-medium">Mobile number<Input name="phone" type="tel" autoComplete="tel" placeholder="(555) 123-4567" value={phone} onChange={event => setPhone(event.target.value)} required disabled={pending} /></label>
            <p className="text-xs leading-5 text-muted-foreground">US numbers can use 10 digits. For other countries, include + and the country code.</p>
            <p className="text-xs leading-5 text-muted-foreground">By choosing “Text me a verification code,” you request a one-time Shopfia text. Message and data rates may apply.</p>
            <Button type="submit" disabled={pending} className="w-full">{pending ? "Sending code…" : "Text me a verification code"}</Button>
          </form> : <form className="mt-5 grid gap-4" action={async form => {
            setPending(true); setError(""); setMessage("");
            try {
              const result = await confirmPhoneCodeAction(form);
              if (!result.ok) setError(result.error ?? "Please try again.");
              else { setSent(false); setOpen(false); setPhone(""); setMessage("Your mobile number is verified."); router.refresh(); }
            } catch { setError("Could not verify your number. Please try again."); }
            finally { setPending(false); }
          }}>
            <label className="grid gap-2 text-sm font-medium">Verification code<Input key="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="123456" required disabled={pending} autoFocus className="text-center text-xl tracking-[0.4em]" /></label>
            <Button type="submit" disabled={pending} className="w-full">{pending ? "Verifying…" : "Verify number"}</Button>
            <div className="flex flex-wrap justify-between gap-3 text-sm"><button type="button" disabled={pending} className="underline disabled:opacity-50" onClick={() => {setSent(false); setError(""); setMessage("");}}>Use a different number</button><button type="button" disabled={pending} className="underline disabled:opacity-50" onClick={() => void sendCode()}>Resend code</button></div>
          </form>}
          {message ? <p role="status" className="mt-4 text-sm">{message}</p> : null}
          {error ? <p role="alert" className="mt-4 text-sm text-red-700">{error}</p> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
    {!configured ? <p className="mt-4 text-sm text-muted-foreground">Phone verification is not available in this environment yet.</p> : null}
    {!open && message ? <p role="status" className="mt-4 text-sm text-emerald-800">{message}</p> : null}
  </section>;
}
