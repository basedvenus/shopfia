import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  db: { $transaction: vi.fn() },
  reminders: vi.fn()
}));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/services/reviews", () => ({ scheduleReviewRemindersForCompletedOrder: mocks.reminders }));

import { finalizeOrder, issueRefund } from "@/lib/services/marketplace-fees";

function fixture(autoRenew = false) {
  const seller = { id: "seller_test", defaultShopId: "shop_test", offsiteAdsEnabled: false, offsiteAdsTier: "STANDARD" };
  const listing = { id: "listing_test", autoRenew, availableQuantity: 3, quantity: 3, status: "ACTIVE", sellerId: seller.id, shopId: "shop_test" };
  const order = {
    id: "order_test", vendorProfileId: "vendor_test", sellerId: seller.id, shopId: "shop_test", listingId: listing.id,
    status: "awaiting_payment", paymentSucceededAt: null as Date | null, completedAt: null as Date | null,
    reviewEligibleAt: null as Date | null, amountCents: 10000, itemSubtotalCents: 10000, buyerTotalCents: 10000,
    shippingAmountCents: 0, taxAmountCents: 0, giftWrapAmountCents: 0, taxRemittedByMarketplace: false,
    offsiteAdsAttributed: false, offsiteAdsTier: "STANDARD"
  };
  let breakdown: Record<string, unknown> | null = null;
  let payout: Record<string, unknown> | null = null;
  const snapshot = () => ({ ...order, listing: { ...listing }, seller: { ...seller }, feeBreakdown: breakdown, payout });
  const tx = {
    order: {
      findUnique: vi.fn(async () => snapshot()),
      update: vi.fn(async ({ data }) => { Object.assign(order, data); return snapshot(); }),
      // Model only PostgreSQL's atomic conditional UPDATE, not transaction scheduling.
      // Concurrent calls can both read the old order; exactly one may claim this predicate.
      updateMany: vi.fn(async ({ where, data }) => {
        if (where.paymentSucceededAt === null && order.paymentSucceededAt !== null) return { count: 0 };
        if (where.paymentSucceededAt?.not === null && order.paymentSucceededAt === null) return { count: 0 };
        if (where.completedAt === null && order.completedAt !== null) return { count: 0 };
        if (where.status?.in && !where.status.in.includes(order.status)) return { count: 0 };
        Object.assign(order, data);
        return { count: 1 };
      })
    },
    vendorProfile: { findUnique: vi.fn(async () => ({ id: "vendor_test", userId: "vendor_user_test", managers: [], slug: "test-shop", name: "Synthetic Shop" })) },
    seller: { upsert: vi.fn(async () => seller), update: vi.fn(async () => seller) },
    shop: { findUnique: vi.fn(async () => null), upsert: vi.fn(async () => ({ id: "shop_test" })) },
    listing: {
      findUnique: vi.fn(async () => ({ ...listing })),
      update: vi.fn(async ({ data }) => { Object.assign(listing, data); return { ...listing }; })
    },
    listingFeeEvent: { create: vi.fn(async ({ data }) => ({ ...data, id: "fee_test" })) },
    marketplaceFeeConfig: { upsert: vi.fn(async () => ({ transactionFeeBasisPoints: 650, paymentProcessingBasisPoints: 300, paymentProcessingFlatCents: 25, offsiteAdsStandardBasisPoints: 1500, offsiteAdsHighVolumeBasisPoints: 1200, offsiteAdsEnabled: false, listingFeeFlatCents: 20, listingDurationDays: 120 })) },
    orderFeeBreakdown: { upsert: vi.fn(async ({ create, update }) => { breakdown = breakdown ? { ...breakdown, ...update } : { ...create }; return breakdown; }) },
    payout: { upsert: vi.fn(async ({ create, update }) => { payout = payout ? { ...payout, ...update } : { ...create }; return payout; }) }
  };
  mocks.db.$transaction.mockImplementation(async (run) => run(tx));
  return { tx, order, listing, snapshot };
}

describe("payment fulfillment is applied once", () => {
  beforeEach(async () => { vi.clearAllMocks(); await import("@/lib/db"); });

  it("does not sell the same inventory again when a paid order is completed", async () => {
    const f = fixture();
    await finalizeOrder({ orderId: f.order.id, status: "paid", paymentSucceeded: true });
    const paidAt = f.order.paymentSucceededAt;
    await finalizeOrder({ orderId: f.order.id, status: "completed", paymentSucceeded: false });
    await finalizeOrder({ orderId: f.order.id, status: "completed", paymentSucceeded: false });
    expect(f.listing.availableQuantity).toBe(2);
    expect(f.tx.listing.update).toHaveBeenCalledTimes(1);
    expect(f.tx.orderFeeBreakdown.upsert).toHaveBeenCalledTimes(1);
    expect(f.order.paymentSucceededAt).toEqual(paidAt);
    expect(mocks.reminders).toHaveBeenCalledTimes(1);
  });

  it("does not renew or charge a listing fee twice across payment and completion", async () => {
    const f = fixture(true);
    await finalizeOrder({ orderId: f.order.id, status: "paid", paymentSucceeded: true });
    await finalizeOrder({ orderId: f.order.id, status: "completed", paymentSucceeded: false });
    expect(f.tx.listingFeeEvent.create).toHaveBeenCalledTimes(1);
    expect(f.tx.orderFeeBreakdown.upsert).toHaveBeenCalledTimes(1);
  });

  it("atomically claims duplicate concurrent payment success before side effects", async () => {
    const f = fixture();
    const client = mocks.db as unknown as Pick<PrismaClient, "$transaction">;
    await Promise.all(Array.from({ length: 2 }, () => finalizeOrder({ orderId: f.order.id, status: "paid", paymentSucceeded: true }, client)));
    expect(f.tx.listing.update).toHaveBeenCalledTimes(1);
    expect(f.tx.orderFeeBreakdown.upsert).toHaveBeenCalledTimes(1);
    expect(f.tx.payout.upsert).toHaveBeenCalledTimes(1);
    expect(f.tx.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: f.order.id, paymentSucceededAt: null })
    }));
  });

  it("does not downgrade a completed order on a delayed success event", async () => {
    const f = fixture();
    await finalizeOrder({ orderId: f.order.id, status: "paid", paymentSucceeded: true });
    await finalizeOrder({ orderId: f.order.id, status: "completed", paymentSucceeded: false });
    await finalizeOrder({ orderId: f.order.id, status: "paid", paymentSucceeded: true });
    expect(f.order.status).toBe("completed");
    expect(f.tx.listing.update).toHaveBeenCalledTimes(1);
  });

  it("rejects completion of an unpaid order before any fulfillment side effect", async () => {
    const f = fixture();
    await expect(finalizeOrder({ orderId: f.order.id, status: "completed", paymentSucceeded: false })).rejects.toThrow(/unpaid/);
    expect(f.tx.listing.update).not.toHaveBeenCalled();
  });

  it("fails rather than silently acknowledging payment in an unreconciled unpaid state", async () => {
    const f = fixture();
    f.order.status = "in_progress";
    await expect(finalizeOrder({ orderId: f.order.id, status: "paid", paymentSucceeded: true })).rejects.toThrow(/reconciliation/);
    expect(f.order.paymentSucceededAt).toBeNull();
    expect(f.tx.listing.update).not.toHaveBeenCalled();
  });

  it("can retry after a failure rolls the transaction claim back", async () => {
    const f = fixture();
    mocks.db.$transaction.mockImplementationOnce(async (run) => {
      const before = { ...f.order };
      try { return await run(f.tx); }
      catch (error) { Object.assign(f.order, before); throw error; }
    });
    f.tx.listing.update.mockRejectedValueOnce(new Error("synthetic write failure"));
    await expect(finalizeOrder({ orderId: f.order.id, status: "paid", paymentSucceeded: true })).rejects.toThrow("synthetic write failure");
    expect(f.order.paymentSucceededAt).toBeNull();
    expect(f.order.status).toBe("awaiting_payment");
    await finalizeOrder({ orderId: f.order.id, status: "paid", paymentSucceeded: true });
    expect(f.order.status).toBe("paid");
    expect(f.listing.availableQuantity).toBe(2);
    expect(f.tx.orderFeeBreakdown.upsert).toHaveBeenCalledTimes(1);
  });

  it("does not claim a refund completed without provider confirmation", async () => {
    fixture();
    await expect(issueRefund({ orderId: "order_test", refundAmountCents: 10000 })).rejects.toThrow(/Stripe/);
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });
});
