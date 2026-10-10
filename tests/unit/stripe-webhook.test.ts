import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";

const mocks = vi.hoisted(() => ({
  signature: "", stripe: {} as { webhooks: Stripe.Webhooks; paymentIntents: { retrieve: ReturnType<typeof vi.fn> } },
  db: { order: { findFirst: vi.fn(), updateMany: vi.fn() }, vendorProfile: { updateMany: vi.fn() } },
  finalize: vi.fn(), log: vi.fn()
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "stripe-signature": mocks.signature }) }));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/services/marketplace-fees", () => ({ finalizeOrder: mocks.finalize }));
vi.mock("@/lib/security/request", () => ({ enforceRequestRateLimit: () => null }));
vi.mock("@/lib/security/audit-log", () => ({ securityLog: mocks.log }));
vi.mock("@/lib/stripe", () => ({ getStripeServer: () => mocks.stripe, getConnectReadiness: vi.fn() }));
import { POST } from "@/app/api/stripe/webhook/route";

const signingSecret = "whsec_synthetic_unit_test_only";
function request(type: string, object: Record<string, unknown>, valid = true) {
  const payload = JSON.stringify({ id: "evt_synthetic", object: "event", type, data: { object }, livemode: false });
  mocks.signature = mocks.stripe.webhooks.generateTestHeaderString({ payload, secret: valid ? signingSecret : "incorrect_test_secret" });
  return new Request("https://example.test/api/stripe/webhook", { method: "POST", body: payload });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", signingSecret);
  // Only the local signature implementation is real. No API method is used.
  const sdk = new Stripe("sk_test_synthetic_unit_test_only");
  mocks.stripe = { webhooks: sdk.webhooks, paymentIntents: { retrieve: vi.fn(async () => ({ latest_charge: "ch_synthetic" })) } };
  mocks.db.order.findFirst.mockResolvedValue({ id: "order_synthetic", status: "awaiting_payment" });
  mocks.db.order.updateMany.mockResolvedValue({ count: 1 });
});
afterEach(() => vi.unstubAllEnvs());

describe("Stripe webhook state handling", () => {
  it("rejects a cryptographically invalid signature before database use", async () => {
    expect((await POST(request("payment_intent.succeeded", { id: "pi_synthetic" }, false))).status).toBe(400);
    expect(mocks.db.order.findFirst).not.toHaveBeenCalled();
    expect(mocks.finalize).not.toHaveBeenCalled();
  });

  it("keeps a declined attempt retryable so a later verified success can settle", async () => {
    await POST(request("payment_intent.payment_failed", { id: "pi_synthetic" }));
    expect(mocks.db.order.updateMany).not.toHaveBeenCalled();
    await POST(request("payment_intent.succeeded", { id: "pi_synthetic", latest_charge: "ch_synthetic" }));
    expect(mocks.finalize).toHaveBeenCalledWith({ orderId: "order_synthetic", status: "paid", paymentSucceeded: true });
  });

  it("can reconcile a verified success for a previously canceled unpaid order", async () => {
    mocks.db.order.findFirst.mockResolvedValue({ id: "order_synthetic", status: "canceled" });
    await POST(request("payment_intent.succeeded", { id: "pi_synthetic", latest_charge: "ch_synthetic" }));
    expect(mocks.finalize).toHaveBeenCalledTimes(1);
  });

  it("does not acknowledge an unrecorded payment when finalization requires reconciliation", async () => {
    mocks.db.order.findFirst.mockResolvedValue({ id: "order_synthetic", status: "in_progress", paymentSucceededAt: null });
    mocks.finalize.mockRejectedValueOnce(new Error("Verified payment requires order-state reconciliation"));
    await expect(POST(request("payment_intent.succeeded", { id: "pi_synthetic", latest_charge: "ch_synthetic" }))).rejects.toThrow(/reconciliation/);
  });

  it("binds Checkout metadata to the stored session before settling", async () => {
    await POST(request("checkout.session.completed", { id: "cs_test_synthetic", metadata: { orderId: "order_synthetic" }, payment_intent: "pi_synthetic", payment_status: "paid" }));
    expect(mocks.db.order.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "order_synthetic", stripeCheckoutSessionId: "cs_test_synthetic" } }));
    expect(mocks.finalize).toHaveBeenCalledTimes(1);
  });

  it("does not finalize unpaid Checkout completion", async () => {
    await POST(request("checkout.session.completed", { id: "cs_test_synthetic", metadata: { orderId: "order_synthetic" }, payment_intent: "pi_synthetic", payment_status: "unpaid" }));
    expect(mocks.finalize).not.toHaveBeenCalled();
  });

  it("does not finalize after the session binding loses a concurrent update", async () => {
    mocks.db.order.updateMany.mockResolvedValue({ count: 0 });
    await POST(request("checkout.session.completed", { id: "cs_test_synthetic", metadata: { orderId: "order_synthetic" }, payment_intent: "pi_synthetic", payment_status: "paid" }));
    expect(mocks.finalize).not.toHaveBeenCalled();
  });

  it("does not retrieve or attach a payment for an unmatched Checkout", async () => {
    mocks.db.order.findFirst.mockResolvedValue(null);
    await POST(request("checkout.session.completed", { id: "cs_test_other", metadata: { orderId: "order_synthetic" }, payment_intent: "pi_other", payment_status: "paid" }));
    expect(mocks.stripe.paymentIntents.retrieve).not.toHaveBeenCalled();
    expect(mocks.db.order.updateMany).not.toHaveBeenCalled();
  });

  it.each(["checkout.session.expired", "checkout.session.async_payment_failed"])("cancels only the matching unpaid Checkout for %s", async (type) => {
    await POST(request(type, { id: "cs_test_synthetic" }));
    expect(mocks.db.order.updateMany).toHaveBeenCalledWith({ where: { stripeCheckoutSessionId: "cs_test_synthetic", status: "awaiting_payment", paymentSucceededAt: null }, data: { status: "canceled" } });
  });
});
