"use client";
import Link from "next/link";
import { useState } from "react";
import { MessageSquareText } from "lucide-react";
import { updateBusinessSmsAction } from "@/app/actions/business-sms";

export function BusinessSmsToggle({enabled, verified, deliveryReady}: {enabled:boolean;verified:boolean;deliveryReady:boolean}) {
  const [checked,setChecked] = useState(enabled);
  const [pending,setPending] = useState(false);
  const [message,setMessage] = useState("");
  return <div className="mt-5 rounded-2xl border p-4">
    <label className="flex items-center gap-3"><MessageSquareText className="h-5 w-5 shrink-0 text-primary" /><span className="flex-1 text-sm font-medium">Text me about new business messages</span>
      <input type="checkbox" role="switch" checked={checked} disabled={pending || !verified} className="h-5 w-5 accent-[#bf7f79]" onChange={async (event) => {
        const next = event.target.checked; setPending(true);setMessage("");
        try {const result=await updateBusinessSmsAction(next);if(result.ok){setChecked(next);setMessage(next ? deliveryReady ? "Text notifications are on." : "Preference saved. Text delivery will start when Shopfia’s sender setup is complete." : "Text notifications are off.");}else setMessage(result.error ?? "Please try again.");}
        catch {setMessage("Could not save your preference. Please try again.");}finally{setPending(false);}
      }} />
    </label>
    <p className="mt-2 text-xs leading-5 text-muted-foreground">Receive Shopfia texts when a customer messages or sends an inquiry to your business. Frequency varies. Message and data rates may apply. Reply STOP to unsubscribe or HELP for help. Consent is not a condition of purchase. Turn this off anytime. <Link href="/terms" className="underline">Terms</Link> · <Link href="/privacy" className="underline">Privacy</Link></p>
    {!verified ? <a href="#phone-verification" className="mt-2 inline-block text-xs underline">Verify your number to turn on texts</a> : !deliveryReady ? <p className="mt-2 text-xs text-amber-800">Sender activation pending—notification texts are not being delivered yet.</p> : null}
    {message ? <p role="status" className="mt-2 text-xs">{message}</p> : null}
  </div>;
}
