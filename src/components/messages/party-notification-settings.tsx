"use client";

import { useState } from "react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Bell, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PartyNotificationSettings({ email, emailEnabled, saveAction, setup = false, children, emailAddress, emailVerified = false }: {
  email: boolean;
  emailEnabled: boolean;
  saveAction: (form: FormData) => Promise<void>;
  setup?: boolean;
  children?: ReactNode;
  emailAddress?: string | null;
  emailVerified?: boolean;
}) {
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  if (setup && saved) return <p role="status" className="text-sm text-muted-foreground">Preferences saved. You can update them in <Link href="/account/notifications" className="underline">profile settings</Link>.</p>;
  return <section className="rounded-3xl border bg-white p-6" aria-label="Notification preferences">
    <div className="flex items-center gap-2"><Bell className="h-5 w-5 text-primary" /><h2 className="text-xl font-semibold">{setup ? "Stay in the loop" : "Notification preferences"}</h2></div>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">Invitations, guest submissions, and approval updates always appear in your notification inbox. Choose whether you’d also like party updates by email.</p>
    {emailAddress ? <div className={`mt-5 flex flex-wrap items-center gap-3 rounded-2xl border p-4 text-sm ${emailVerified ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-border bg-muted/30"}`}>
      <Mail className="h-5 w-5" />
      <div className="min-w-0 flex-1"><p className="font-medium">Email address</p><p className="break-all">{emailAddress}</p></div>
      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${emailVerified ? "bg-emerald-100 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{emailVerified ? <ShieldCheck className="h-3.5 w-3.5" /> : null}{emailVerified ? "Verified" : "Not verified"}</span>
    </div> : null}
    <form className="mt-5 grid gap-4" action={async (form) => {
      setPending(true); setError("");
      try { await saveAction(form); setSaved(true); }
      catch { setError("Your preferences could not be saved. Please try again."); }
      finally { setPending(false); }
    }}>
      <label className="flex items-center gap-3 rounded-2xl border p-4"><Mail className="h-5 w-5 text-primary" /><span className="flex-1 text-sm font-medium">Email me party updates</span><input name="email" type="checkbox" defaultChecked={email} disabled={!emailEnabled || pending} className="h-4 w-4 accent-[#bf7f79]" /></label>
      {!emailEnabled ? <p className="text-xs text-muted-foreground">Email delivery is not connected yet. Website notifications remain active.</p> : null}
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      {!setup && saved ? <p role="status" className="text-sm text-muted-foreground">Preferences saved.</p> : null}
      <div className="flex flex-wrap items-center gap-4"><Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save preferences"}</Button>{setup ? <p className="text-xs text-muted-foreground">You can change these later in profile settings.</p> : null}</div>
    </form>
    {children}
  </section>;
}
