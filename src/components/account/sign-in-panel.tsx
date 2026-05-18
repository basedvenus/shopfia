"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { createPasswordAccountAction, requestPasswordResetAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SignInPanelProps = {
  googleEnabled: boolean;
  emailEnabled: boolean;
};

export function SignInPanel({ googleEnabled, emailEnabled }: SignInPanelProps) {
  const [mode, setMode] = useState<"sign-in" | "sign-up" | "forgot-password">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isForgotPassword = mode === "forgot-password";

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
      <div className="rounded-3xl bg-[#fff8f5] px-4 py-3 text-sm leading-6 text-muted-foreground">
        {mode === "sign-up"
          ? "Step 1 of 3: create your login. Next, you will choose your public @username and display name."
          : isForgotPassword
            ? "Enter your email and we will send a secure link to create a new password."
            : "Sign in to favorite vendors, message creatives, save inspiration, and create party galleries."}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            setMessage(null);

            if (isForgotPassword) {
              const formData = new FormData();
              formData.set("email", email);
              const result = await requestPasswordResetAction(formData);
              setMessage(
                result.ok
                  ? result.message ?? "Check your email for a reset link."
                  : result.error ?? "Could not send a reset link."
              );
              return;
            }

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
              callbackUrl: mode === "sign-up" ? "/account/setup" : "/explore",
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

            window.location.href = mode === "sign-up" ? "/account/setup" : "/explore";
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
        {!isForgotPassword ? (
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
            minLength={8}
            required
          />
        ) : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending
            ? isForgotPassword
              ? "Sending..."
              : mode === "sign-up"
              ? "Creating..."
              : "Signing in..."
            : isForgotPassword
              ? "Send Reset Link"
              : mode === "sign-up"
              ? "Continue"
              : "Sign in"}
        </Button>
      </form>
      {mode === "sign-in" ? (
        <button
          type="button"
          className="text-sm font-medium text-[#9b6b65] underline-offset-4 hover:underline"
          onClick={() => {
            setMode("forgot-password");
            setMessage(null);
          }}
        >
          Forgot Password?
        </button>
      ) : null}
      {isForgotPassword ? (
        <button
          type="button"
          className="text-sm font-medium text-[#9b6b65] underline-offset-4 hover:underline"
          onClick={() => {
            setMode("sign-in");
            setMessage(null);
          }}
        >
          Back to sign in
        </button>
      ) : null}
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
                callbackUrl: "/account/setup",
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
      {googleEnabled ? (
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          disabled={pending}
          onClick={() => {
            signIn("google", { callbackUrl: "/account/setup" });
          }}
        >
          Continue with Google
        </Button>
      ) : null}
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}
