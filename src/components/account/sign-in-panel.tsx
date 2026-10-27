"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { createPasswordAccountAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SignInPanelProps = {
  callbackUrl?: string;
  googleEnabled: boolean;
  emailEnabled: boolean;
};

export function SignInPanel({ callbackUrl = "/explore", googleEnabled, emailEnabled }: SignInPanelProps) {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [showRecovery, setShowRecovery] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 rounded-full bg-muted p-1">
        <button
          type="button"
          className={`rounded-full px-3 py-2 text-sm font-medium transition ${
            mode === "sign-in" ? "bg-white shadow-sm" : "text-muted-foreground"
          }`}
          onClick={() => {
            setMode("sign-in");
            setMessage(null);
            setShowRecovery(false);
          }}
        >
          Sign in
        </button>
        <button
          type="button"
          className={`rounded-full px-3 py-2 text-sm font-medium transition ${
            mode === "sign-up" ? "bg-white shadow-sm" : "text-muted-foreground"
          }`}
          onClick={() => {
            setMode("sign-up");
            setMessage(null);
            setShowRecovery(false);
          }}
        >
          Create account
        </button>
      </div>
      <div className="rounded-3xl bg-[#fff8f5] px-4 py-3 text-sm leading-6 text-muted-foreground">
        {mode === "sign-up"
          ? "Step 1 of 3: create your login. Next, you will choose your public @username and display name."
          : "Sign in to favorite vendors, message creatives, save inspiration, and create party galleries."}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            setMessage(null);

            if (mode === "sign-up") {
              const formData = new FormData();
              formData.set("email", email);
              formData.set("password", password);
              const result = await createPasswordAccountAction(formData);

              if (!result.ok) {
                setMessage(result.error ?? "Could not create an account.");
                return;
              }
            }

            const result = await signIn("credentials", {
              email,
              password,
              callbackUrl: mode === "sign-up" ? "/account/setup" : callbackUrl,
              redirect: false
            });

            if (result?.error) {
              setMessage(
                result.error === "Configuration" || result.error === "CallbackRouteError"
                  ? "Sign-in is temporarily unavailable while ShopFia reconnects to the database. Please try again shortly."
                  : mode === "sign-up"
                    ? "Account created, but sign-in failed. Try signing in."
                    : "Email or password is incorrect."
              );
              return;
            }

            window.location.href = mode === "sign-up" ? "/account/setup" : callbackUrl;
          });
        }}
        className="space-y-2"
      >
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="email"
          required
        />
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
          minLength={8}
          required
        />
        <Button type="submit" className="w-full" disabled={pending}>
          {pending
            ? mode === "sign-up"
              ? "Creating..."
              : "Signing in..."
            : mode === "sign-up"
              ? "Continue"
              : "Sign in"}
        </Button>
      </form>
      {googleEnabled ? (
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          disabled={pending}
          onClick={() => {
            signIn("google", { callbackUrl });
          }}
        >
          Sign in with Google
        </Button>
      ) : null}
      {mode === "sign-in" ? (
        <div className="space-y-3">
          <button
            type="button"
            aria-expanded={showRecovery}
            aria-controls="sign-in-recovery"
            className="text-sm font-medium text-[#9b6b65] underline-offset-4 hover:underline"
            onClick={() => { setShowRecovery((current) => !current); setMessage(null); }}
          >
            Forgot password?
          </button>
          {showRecovery ? (
            <div id="sign-in-recovery" className="space-y-3 rounded-2xl border p-4">
              {emailEnabled ? (
                <form className="space-y-3" onSubmit={(event) => {
                  event.preventDefault();
                  startTransition(async () => {
                    setMessage(null);
                    try {
                      const result = await signIn("nodemailer", { email, callbackUrl, redirect: false });
                      setMessage(result?.error ? "Could not send a sign-in link. Please try again." : "Check your email for the magic link.");
                    } catch {
                      setMessage("Could not send a sign-in link. Please try again.");
                    }
                  });
                }}>
                  <p className="text-sm text-muted-foreground">We’ll email you a magic link to sign in without your password.</p>
                  <Input type="email" aria-label="Recovery email" placeholder="Email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                  <Button type="submit" variant="secondary" className="w-full" disabled={pending}>Send magic link</Button>
                </form>
              ) : null}
              <Link href="/account/forgot-password" className="inline-block text-sm font-medium text-[#9b6b65] underline-offset-4 hover:underline">Reset your password</Link>
            </div>
          ) : null}
        </div>
      ) : null}
      {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}
