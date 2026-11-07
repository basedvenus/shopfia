"use client";

import Link from "next/link";
import { useState } from "react";
import { Mail, MessageSquareText } from "lucide-react";
import { updatePartyNotificationPreferenceAction } from "@/app/actions/notifications";
import { updateBusinessSmsAction } from "@/app/actions/business-sms";

export function DeliveryPreferences({ email, text, emailReady, phoneVerified, preview = false }: {
  email: boolean; text: boolean; emailReady: boolean; phoneVerified: boolean; preview?: boolean;
}) {
  const [values, setValues] = useState({ email, text });
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  return <div className="grid gap-3 border-t pt-5 mt-5">
    {([{key:"email", label:"Email notifications", Icon:Mail, description:"Party invitations and updates by email.", available:emailReady},
      {key:"text",label:"Text notifications",Icon:MessageSquareText,description:"New business messages and inquiries by text.",available:phoneVerified}] as const).map(({key,label,Icon,description,available}) => <button key={key} type="button" role="switch" aria-checked={values[key]} disabled={pending || !available} onClick={async () => {
        const next = !values[key]; setPending(true); setMessage("");
        try {
          if (!preview) {
            if (key === "email") { const form = new FormData(); if(next) form.set("email","on"); await updatePartyNotificationPreferenceAction(form); }
            else { const result = await updateBusinessSmsAction(next); if(!result.ok) throw new Error(result.error ?? "Could not save text preferences."); }
          }
          setValues(current => ({...current,[key]:next})); setMessage(preview ? "Preview preference updated." : "Preference saved.");
        } catch { setMessage("Could not save your preference. Please try again."); } finally { setPending(false); }
      }} className="flex items-center gap-3 rounded-2xl border p-4 text-left disabled:opacity-50">
      <Icon className="h-5 w-5 shrink-0 text-primary" /><span className="flex-1"><span className="block text-sm font-semibold">{label}</span><span className="block mt-1 text-xs text-muted-foreground">{!available ? key === "text" ? "Confirm your phone number to enable texts." : "Email delivery is currently unavailable." : description}</span></span>
      <span className={`h-6 w-11 shrink-0 rounded-full p-1 ${values[key] ? "bg-[#d8a39c]" : "bg-[#e4d9d2]"}`}><span className={`block h-4 w-4 rounded-full bg-white transition ${values[key] ? "translate-x-5" : ""}`} /></span>
    </button>)}
    <p className="text-xs leading-5 text-muted-foreground">Text frequency varies. Message and data rates may apply. Reply STOP to unsubscribe or HELP for help. Consent is not a condition of purchase. <Link href="/terms" className="underline">Terms</Link> · <Link href="/privacy" className="underline">Privacy</Link></p>
    {message ? <p role="status" className="text-xs">{message}</p> : null}
  </div>;
}
