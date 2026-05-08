"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SignInPanelProps = {
  googleEnabled: boolean;
  emailEnabled: boolean;
  missingGoogleConfig: string[];
};

export function SignInPanel({ googleEnabled, emailEnabled, missingGoogleConfig }: SignInPanelProps) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const hasAnyProvider = googleEnabled || emailEnabled;
  const missingGoogleMessage = missingGoogleConfig.join(", ");

  return (
    <div className="space-y-3">
      {!hasAnyProvider ? (
        <p className="rounded-2xl border border-dashed p-3 text-sm text-muted-foreground">
          Sign-in is almost ready. Add {missingGoogleMessage} in Vercel to
          enable Google accounts.
        </p>
      ) : null}
      {emailEnabled ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
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
          />
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Sending..." : "Send magic link"}
          </Button>
        </form>
      ) : (
        <p className="text-xs text-muted-foreground">
          Magic-link email is not configured yet.
        </p>
      )}
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
