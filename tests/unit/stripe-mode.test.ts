import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ retrieve: vi.fn(), configurationError: false }));
vi.mock("@/lib/stripe", () => ({ getStripeServer: () => {
  if (mocks.configurationError) throw new Error("Synthetic missing configuration");
  return { balance: { retrieve: mocks.retrieve } };
} }));

describe("server Stripe mode verification", () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); mocks.configurationError = false; vi.useFakeTimers(); vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "commit_under_test"); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

  it("returns only mode and commit, never balances or provider data", async () => {
    mocks.retrieve.mockResolvedValue({ livemode: false, available: [{ amount: 987654 }], pending: [{ amount: 999 }], secret: "must_not_return" });
    const { readStripeMode } = await import("@/lib/services/stripe-mode");
    expect(await readStripeMode()).toEqual({ livemode: false, commit: "commit_under_test" });
  });

  it("reports live mode honestly rather than assuming every configured account is test", async () => {
    mocks.retrieve.mockResolvedValue({ livemode: true });
    const { readStripeMode } = await import("@/lib/services/stripe-mode");
    expect((await readStripeMode()).livemode).toBe(true);
  });

  it("coalesces concurrent reads and refreshes the short cache", async () => {
    mocks.retrieve.mockResolvedValue({ livemode: false });
    const { readStripeMode } = await import("@/lib/services/stripe-mode");
    await Promise.all([readStripeMode(), readStripeMode()]);
    await readStripeMode();
    expect(mocks.retrieve).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(30_001);
    await readStripeMode();
    expect(mocks.retrieve).toHaveBeenCalledTimes(2);
  });

  it("fails closed on a missing flag and does not expose provider errors", async () => {
    mocks.retrieve.mockResolvedValue({});
    const { readStripeMode } = await import("@/lib/services/stripe-mode");
    await expect(readStripeMode()).rejects.toThrow("Stripe mode could not be verified");
    mocks.retrieve.mockRejectedValue(new Error("sensitive provider details"));
    await expect(readStripeMode()).rejects.toThrow("Stripe mode could not be verified");
    mocks.retrieve.mockResolvedValue({ livemode: false });
    expect((await readStripeMode()).livemode).toBe(false);
  });

  it("clears a synchronous configuration failure so a later check can recover", async () => {
    mocks.configurationError = true;
    const { readStripeMode } = await import("@/lib/services/stripe-mode");
    await expect(readStripeMode()).rejects.toThrow("Stripe mode could not be verified");
    expect(mocks.retrieve).not.toHaveBeenCalled();
    mocks.configurationError = false;
    mocks.retrieve.mockResolvedValue({ livemode: false });
    expect((await readStripeMode()).livemode).toBe(false);
  });
});
