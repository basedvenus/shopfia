"use client";

import Link from "next/link";
import { useState } from "react";
import { requestPasswordResetAction } from "@/app/actions/password-reset";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [accountNotFound, setAccountNotFound] = useState(false);
  const [success, setSuccess] = useState(false);

  return (
    <form className="grid gap-4" onSubmit={async (event) => {
      event.preventDefault();
      if (pending) return;
      setPending(true);
      setMessage(null);
      setSuccess(false);
      setAccountNotFound(false);
      try {
        const formData = new FormData();
        formData.set("email", email);
        const result = await requestPasswordResetAction(formData);
        setSuccess(result.ok);
        setAccountNotFound(result.reason === "account-not-found");
        setMessage(result.ok ? result.message ?? "Check your email for a reset link." : result.error ?? "Could not request a reset link.");
      } catch {
        setMessage("Could not request a reset link. Please try again shortly.");
      } finally {
        setPending(false);
      }
    }}>
      <div className="grid gap-2">
        <label htmlFor="reset-email" className="text-sm font-medium">Account email</label>
        <Input id="reset-email" name="email" type="email" autoComplete="email" placeholder="you@example.com"
          value={email} onChange={(event) => {
            setEmail(event.target.value);
            setMessage(null);
            setAccountNotFound(false);
          }} required maxLength={255} disabled={pending} />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending reset link..." : "Send reset link"}
      </Button>
      {message ? <p role="status" className={`text-sm leading-6 ${success ? "text-muted-foreground" : "text-destructive"}`}>{message}</p> : null}
      {accountNotFound && (
        <p className="text-sm text-muted-foreground">
          New to ShopFia?{" "}
          <Link href="/account?mode=signup" className="font-medium text-[#9b6b65] underline underline-offset-4">
            Create an account
          </Link>
        </p>
      )}
    </form>
  );
}
