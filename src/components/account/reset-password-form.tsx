"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { KeyRound } from "lucide-react";
import { resetPasswordAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ResetPasswordForm({
  email,
  token
}: {
  email: string;
  token: string;
}) {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        setMessage(null);
        startTransition(async () => {
          const result = await resetPasswordAction(formData);
          setMessage(
            result.ok
              ? result.message ?? "Password updated."
              : result.error ?? "Could not update your password."
          );
          setSuccess(result.ok);
        });
      }}
      className="grid gap-3"
    >
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="token" value={token} />
      <Input
        type="email"
        value={email}
        readOnly
        className="bg-white/70"
        aria-label="Account email"
      />
      <Input
        type="password"
        name="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="New password"
        autoComplete="new-password"
        minLength={8}
        required
      />
      <Button type="submit" className="w-full" disabled={isPending || success}>
        <KeyRound className="h-4 w-4" />
        {isPending ? "Updating..." : success ? "Password Updated" : "Create New Password"}
      </Button>
      {message ? (
        <p className={`text-sm ${success ? "text-muted-foreground" : "text-destructive"}`}>
          {message}
        </p>
      ) : null}
      {success ? (
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() => signIn("credentials", { email, password, callbackUrl: "/explore" })}
        >
          Sign in
        </Button>
      ) : (
        <Link href="/account" className="text-sm font-medium text-[#9b6b65] underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      )}
    </form>
  );
}
