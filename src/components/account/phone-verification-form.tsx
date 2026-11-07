"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Smartphone } from "lucide-react";
import { sendPhoneCodeAction, confirmPhoneCodeAction } from "@/app/actions/phone-verification";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PhoneVerificationForm({ verifiedPhone, configured }: {verifiedPhone: string | null; configured: boolean}) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [editing, setEditing] = useState(!verifiedPhone);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  return <section id="phone-verification" className="mt-5 border-t pt-5">
    <div className="flex items-center gap-2"><Smartphone className="h-5 w-5 text-primary" /><h2 className="text-sm font-medium">Phone number</h2></div>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">Confirm your phone number with a text message code.</p>
    {verifiedPhone ? <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><ShieldCheck className="h-5 w-5" /><span className="flex-1">Mobile number · {verifiedPhone}</span><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">Verified</span><button type="button" onClick={() => {setEditing(!editing); setSent(false); setError(""); setMessage("");}} className="underline">{editing ? "Cancel" : "Change number"}</button></div> : null}
    {!configured ? <p className="mt-4 text-sm text-muted-foreground">Phone verification is not available in this environment yet.</p> : editing ? <div className="mt-5 grid gap-4">
      <form className="grid gap-3" action={async (form) => {
        setPending(true); setError(""); setMessage("");
        try {const result = await sendPhoneCodeAction(form); if (!result.ok) setError(result.error ?? "Please try again."); else {setSent(true); setMessage("Code sent. Check your phone; the code expires in 10 minutes.");}}
        catch {setError("Could not send a code. Please try again.");} finally {setPending(false);}
      }}>
        <label className="grid gap-2 text-sm font-medium">Mobile number<Input name="phone" type="tel" autoComplete="tel" placeholder="(555) 123-4567" value={phone} onChange={(event) => {setPhone(event.target.value); setSent(false); setMessage("");}} required disabled={pending} /></label>
        <p className="text-xs text-muted-foreground">US numbers can use 10 digits. For other countries, include + and the country code.</p>
        <input type="hidden" name="consent" value="on" />
        <p className="text-xs leading-5 text-muted-foreground">By choosing “Text me a verification code,” you request a one-time Shopfia text. Message and data rates may apply.</p>
        <Button type="submit" disabled={pending} className="w-fit">{pending ? "Please wait…" : sent ? "Resend code" : "Text me a verification code"}</Button>
      </form>
      {sent ? <form className="grid gap-3 border-t pt-4" action={async (form) => {
        setPending(true); setError(""); setMessage("");
        try {const result = await confirmPhoneCodeAction(form); if (!result.ok) setError(result.error ?? "Please try again."); else {setSent(false); setEditing(false); setMessage("Your mobile number is verified."); router.refresh();}}
        catch {setError("Could not verify your number. Please try again.");} finally {setPending(false);}
      }}><label className="grid gap-2 text-sm font-medium">Verification code<Input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="123456" required disabled={pending} /></label><Button type="submit" className="w-fit" disabled={pending}>Verify number</Button></form> : null}
    </div> : null}
    {message ? <p role="status" className="mt-4 text-sm">{message}</p> : null}
    {error ? <p role="alert" className="mt-4 text-sm text-red-700">{error}</p> : null}
  </section>;
}
