"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";

export function ConnectStripeButton({ connected }: { connected: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="secondary"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const res = await fetch("/api/stripe/connect", { method: "POST" });
          const data = (await res.json()) as { url?: string; error?: string };
          if (data.url) {
            window.location.href = data.url;
          } else {
            alert(data.error ?? "Failed to start Stripe onboarding");
          }
        });
      }}
    >
      {pending ? "Loading..." : connected ? "Manage Stripe" : "Connect Stripe"}
    </Button>
  );
}
