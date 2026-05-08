"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { createPasswordAccountAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SignInPanelProps = {
  googleEnabled: boolean;
  emailEnabled: boolean;
  missingGoogleConfig: string[];
};

export function SignInPanel({ googleEnabled, emailEnabled, missingGoogleConfig }: SignInPanelProps) {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const hasAnyProvider = googleEnabled || emailEnabled;
  const missingGoogleMessage = missingGoogleConfig.join(", ");

  return (
    <div className="space-y-3">
      {!hasAnyProvider ? (
        <p className="rounded-2xl border border-dashed p-3 text-sm text-muted-foreground">
          Google sign-in is not configured yet. Email and password accounts are
          ready to use.
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2 rounded-full bg-muted p-1">
        <button
          type="button"
          className={`rounded-full px-3 py-2 text-sm font-medium transition ${
            mode === "sign-in" ? "bg-white shadow-sm" : "text-muted-foreground"
          }`}
          onClick={() => {
            setMode("sign-in");
            setMessage(null);
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
          }}
        >
          Create account
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            setMessage(null);

            if (mode === "sign-up") {
              const formData = new FormData();
              formData.set("name", name);
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
              callbackUrl: "/explore",
              redirect: false
            });

            if (result?.error) {
              setMessage(
                mode === "sign-up"
                  ? "Account created, but sign-in failed. Try signing in."
                  : "Email or password is incorrect."
              );
              return;
            }

            window.location.href = "/explore";
          });
        }}
        className="space-y-2"
      >
        {mode === "sign-up" ? (
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            autoComplete="name"
          />
        ) : null}
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
              ? "Create account"
              : "Sign in"}
        </Button>
      </form>
      {emailEnabled ? (
        <p className="text-xs text-muted-foreground">
          Prefer a magic link? Email sign-in is also available.
        </p>
      ) : null}
      {emailEnabled ? (
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          disabled={pending}
          onClick={() => {
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
        >
          Send magic link
        </Button>
      ) : null}
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
      {!googleEnabled && missingGoogleMessage ? (
        <p className="text-xs text-muted-foreground">
          Google needs {missingGoogleMessage} in Vercel.
        </p>
      ) : null}
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}
