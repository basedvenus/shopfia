import { getStripeServer } from "@/lib/stripe";

type StripeMode = { livemode: boolean; commit: string | null };
let cached: { expiresAt: number; result: StripeMode } | null = null;
let pending: Promise<StripeMode> | null = null;

// This read uses the same server client as Checkout. Never return or log the
// Balance object, account amounts, credentials, or a raw provider error.
export async function readStripeMode(): Promise<StripeMode> {
  if (cached && cached.expiresAt > Date.now()) return cached.result;
  if (pending) return pending;

  // Defer execution until after pending is assigned, including synchronous
  // configuration failures from getStripeServer().
  pending = Promise.resolve().then(async () => {
    try {
      const balance = await getStripeServer().balance.retrieve();
      if (typeof balance.livemode !== "boolean") throw new Error("Unverified mode");
      const result = {
        livemode: balance.livemode,
        commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null
      };
      cached = { expiresAt: Date.now() + 30_000, result };
      return result;
    } catch {
      cached = null;
      throw new Error("Stripe mode could not be verified");
    } finally {
      pending = null;
    }
  });
  return pending;
}
