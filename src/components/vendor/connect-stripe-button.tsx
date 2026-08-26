"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";

export function ConnectStripeButton({ businessSlug, connected }: { businessSlug?: string; connected: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="secondary"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const res = await fetch("/api/stripe/connect", {
            body: JSON.stringify({ businessSlug }),
            headers: { "Content-Type": "application/json" },
            method: "POST"
          });
          const data = (await res.json()) as { url?: string; error?: string };
          if (data.url) {
            window.location.href = data.url;
          } else {
            alert(data.error ?? "We could not open your payout setup. Please try again.");
          }
        });
      }}
    >
      {pending ? "Opening..." : connected ? "Manage payouts" : "Connect bank account"}
    </Button>
  );
}
