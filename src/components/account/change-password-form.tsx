"use client";

import Link from "next/link";
import { useState } from "react";
import { changePasswordAction } from "@/app/actions/change-password";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ChangePasswordForm({ preview = false }: { preview?: boolean }) {
  const [open,setOpen] = useState(false);
  const [pending,setPending] = useState(false);
  const [message,setMessage] = useState("");
  return <section className="rounded-3xl border bg-white p-5 md:p-7">
    <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">Password</h2><Button variant="secondary" aria-expanded={open} aria-controls="change-password-form" disabled={pending} onClick={() => {setOpen(!open);setMessage("");}}>{open ? "Cancel" : "Change password"}</Button></div>
    {open ? <form id="change-password-form" className="mt-5 grid max-w-lg gap-4" onSubmit={async event => {
      event.preventDefault(); if(pending) return;
      const form = event.currentTarget;
      const data = new FormData(form);
      if(data.get("password") !== data.get("confirmPassword")) {setMessage("Your new passwords do not match.");return;}
      if(preview) {form.reset();setMessage("This is a local design preview. No password was changed.");return;}
      setPending(true);setMessage("");
      try {const result = await changePasswordAction(data); if(result.ok) {form.reset();setOpen(false);setMessage(result.warning ?? "Password changed. We sent a confirmation to your email.");} else setMessage(result.error ?? "Could not change your password.");}
      catch {setMessage("Could not change your password. Please try again.");} finally {setPending(false);}
    }}>
      <label className="grid gap-2 text-sm font-medium">Current password<Input type="password" name="currentPassword" autoComplete="current-password" required disabled={pending} /></label>
      <label className="grid gap-2 text-sm font-medium">New password<Input type="password" name="password" autoComplete="new-password" minLength={8} required disabled={pending} /></label>
      <label className="grid gap-2 text-sm font-medium">Confirm new password<Input type="password" name="confirmPassword" autoComplete="new-password" minLength={8} required disabled={pending} /></label>
      <p className="text-xs text-muted-foreground">Use at least 8 characters.</p>
      <div className="flex flex-wrap items-center gap-4"><Button type="submit" disabled={pending}>{pending ? "Updating…" : "Update password"}</Button><Link href="/account/forgot-password" className="text-sm underline">Forgot password?</Link></div>
      {preview ? <p className="text-xs text-muted-foreground">Preview only. Use sample passwords to try the form.</p> : null}
    </form> : null}
    {message ? <p role="status" className="mt-4 text-sm">{message}</p> : null}
  </section>;
}
