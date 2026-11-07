"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function EmailConfirmation({ email, verified, configured, preview = false }: {email:string|null;verified:boolean;configured:boolean;preview?:boolean}) {
  const [pending,setPending] = useState(false);
  const [message,setMessage] = useState("");
  return <div className="mt-5 flex flex-wrap items-center gap-3 border-t pt-5">
    <div className="min-w-0 flex-1 text-sm"><p className="font-medium">Email address</p><p className="break-all text-muted-foreground">{email || "No email address added"}</p></div>
    {verified ? <span className="text-sm font-medium text-emerald-700">Verified</span> : <Button variant="secondary" disabled={pending || !configured || !email} onClick={async () => {
      if (preview) {setMessage("Preview: a confirmation link would be sent to your email. Verification completes when you open that link.");return;}
      setPending(true); setMessage("");
      try { const result = await signIn("nodemailer", {email, callbackUrl:"/account", redirect:false}); setMessage(result?.error ? "Could not send confirmation. Please try again." : "Check your email for the confirmation link."); }
      catch {setMessage("Could not send confirmation. Please try again.");} finally {setPending(false);}
    }}>{pending ? "Sending…" : "Verify email"}</Button>}
    {!verified && !configured ? <p className="w-full text-xs text-muted-foreground">Email confirmation is currently unavailable.</p> : null}
    {message ? <p role="status" className="w-full text-sm">{message}</p> : null}
  </div>;
}
