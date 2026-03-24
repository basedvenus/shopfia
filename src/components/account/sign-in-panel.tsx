"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SignInPanelProps = {
  googleEnabled: boolean;
  emailEnabled: boolean;
};

export function SignInPanel({ googleEnabled, emailEnabled }: SignInPanelProps) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!emailEnabled) {
            setMessage("Magic link sign-in is not configured yet.");
            return;
          }
          startTransition(async () => {
            setMessage(null);
            const result = await signIn("nodemailer", {
              email,
              callbackUrl: "/explore",
              redirect: false
            });
            if (result?.error) {
              setMessage("Magic link sign-in failed. Check email provider settings.");
            } else {
              setMessage("Check your email for the magic link.");
            }
          });
        }}
        className="space-y-2"
      >
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email for magic link"
          required
          disabled={!emailEnabled}
        />
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Sending..." : "Send magic link"}
        </Button>
      </form>
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        disabled={!googleEnabled || pending}
        onClick={() => {
          if (!googleEnabled) {
            setMessage("Google sign-in is not configured yet.");
            return;
          }
          signIn("google", { callbackUrl: "/explore" });
        }}
      >
        Continue with Google
      </Button>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}
