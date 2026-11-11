"use client";

import {LanguagePreferenceField} from "@/components/language/language-preference";
import {useLanguage} from "@/components/language/language-provider";
import {updatePreferredLanguageAction} from "@/app/actions/language";
import { useState, useTransition } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { createPasswordAccountAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SignInPanelProps = {
  callbackUrl?: string;
  googleEnabled: boolean;
  initialMode?: "sign-in" | "sign-up";
};

export function SignInPanel({ callbackUrl = "/explore", googleEnabled, initialMode = "sign-in" }: SignInPanelProps) {
  const {language,t}=useLanguage();
  const [preferredLanguage,setPreferredLanguage]=useState(language);
  const [mode, setMode] = useState<"sign-in" | "sign-up">(initialMode);
  const [credentialsInvalid, setCredentialsInvalid] = useState(false);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
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
            setCredentialsInvalid(false);
          }}
        >
          {t("Sign in")}
        </button>
        <button
          type="button"
          className={`rounded-full px-3 py-2 text-sm font-medium transition ${
            mode === "sign-up" ? "bg-white shadow-sm" : "text-muted-foreground"
          }`}
          onClick={() => {
            setMode("sign-up");
            setMessage(null);
            setCredentialsInvalid(false);
          }}
        >
          {t("Create account")}
        </button>
      </div>
      {mode === "sign-in" ? (
        <div className="rounded-3xl bg-[#fff8f5] px-4 py-3 text-sm leading-6 text-muted-foreground">
          Sign in to favorite vendors, message creatives, save inspiration, and create party galleries.
        </div>
      ) : null}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            setMessage(null);
            setCredentialsInvalid(false);

            if (mode === "sign-up") {
              const formData = new FormData();
              formData.set("email", email);
              formData.set("firstName", firstName);
              formData.set("password", password);
              formData.set("preferredLanguage",preferredLanguage);
              const result = await createPasswordAccountAction(formData);

              if (!result.ok) {
                setMessage(result.error ?? "Could not create an account.");
                return;
              }
            }

            const result = await signIn("credentials", {
              email,
              password,
              callbackUrl: mode === "sign-up" ? "/account/verify-phone" : callbackUrl,
              redirect: false
            });

            if (result?.error) {
              if (mode === "sign-in" && result.error === "CredentialsSignin") {
                setCredentialsInvalid(true);
                return;
              }
              setMessage(
                result.error === "Configuration" || result.error === "CallbackRouteError"
                  ? "Sign-in is temporarily unavailable while ShopFia reconnects to the database. Please try again shortly."
                  : mode === "sign-up"
                    ? "Account created, but sign-in failed. Try signing in."
                    : "Could not sign in. Please try again."
              );
              return;
            }

            window.location.href = mode === "sign-up" ? "/account/verify-phone" : callbackUrl;
          });
        }}
        className="space-y-2"
      >
        {mode==="sign-up" && <LanguagePreferenceField value={preferredLanguage} onChange={setPreferredLanguage}/>}
        {mode === "sign-up" ? (
          <Input
              name="firstName"
              aria-label="First name"
              autoComplete="given-name"
              placeholder="First name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              maxLength={80}
              required
          />
        ) : null}
        <Input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setCredentialsInvalid(false); }}
          placeholder={t("Email")}
          autoComplete="email"
          required
        />
        <Input
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setCredentialsInvalid(false); }}
          aria-invalid={credentialsInvalid || undefined}
          aria-describedby={credentialsInvalid ? "sign-in-credentials-error" : undefined}
          className={credentialsInvalid ? "border-red-600 focus-visible:ring-red-600" : undefined}
          placeholder={t("Password")}
          autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
          minLength={mode === "sign-up" ? 8 : undefined}
          required
        />
        {credentialsInvalid ? <p id="sign-in-credentials-error" role="alert" className="text-sm text-red-700">{t("Email or password is incorrect.")}</p> : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {t(pending
            ? mode === "sign-up"
              ? "Creating..."
              : "Signing in..."
            : mode === "sign-up"
              ? "Continue"
              : "Sign in")}
        </Button>
      </form>
      {googleEnabled ? (
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          disabled={pending}
          onClick={async () => {
            if(mode==="sign-up"){const result=await updatePreferredLanguageAction(preferredLanguage);if(!result.ok){setMessage(result.error??"Please try again.");return;}}
            signIn("google", { callbackUrl: mode === "sign-up" ? "/account/verify-phone" : callbackUrl });
          }}
        >
          {t("Sign in with Google")}
        </Button>
      ) : null}
      {mode === "sign-in" && (
        <Link href="/account/forgot-password" className="inline-block text-sm font-medium text-[#9b6b65] underline-offset-4 hover:underline">
          {t("Forgot password?")}
        </Link>
      )}
      {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}
