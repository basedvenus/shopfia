import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  offeringCount: vi.fn(), inquiryCount: vi.fn(), requestCount: vi.fn(),
  orderCount: vi.fn(), aggregate: vi.fn(), transaction: vi.fn()
}));
vi.mock("@/lib/db", () => ({ db: {
  offering: { count: mocks.offeringCount }, inquiry: { count: mocks.inquiryCount },
  quoteRequest: { count: mocks.requestCount },
  order: { count: mocks.orderCount, aggregate: mocks.aggregate },
  $transaction: mocks.transaction
} }));

import { getVendorDashboardStats } from "@/lib/services/vendor-dashboard-stats";

describe("business dashboard totals", () => {
  beforeEach(() => vi.clearAllMocks());

  it("includes activity beyond the recent eight rows and counts linked inquiries once", async () => {
    mocks.transaction.mockResolvedValue([12, 3, 9, 11, { _sum: { buyerTotalCents: 120000 } }, { _sum: { amountCents: 5000 } }]);
    expect(await getVendorDashboardStats("business-a")).toEqual({
      activeServices: 12, openRequests: 12, activeBookings: 11, revenueCents: 125000
    });
    expect(mocks.inquiryCount).toHaveBeenCalledWith({ where: {
      vendorProfileId: "business-a", status: "NEW", quoteRequest: { is: null }
    } });
    for (const [query] of mocks.aggregate.mock.calls) {
      expect(query.where.vendorProfileId).toBe("business-a");
      expect(query.where.paymentSucceededAt).toEqual({ not: null });
      expect(query.where.status.in).not.toContain("awaiting_payment");
    }
  });

  it("shows zero revenue when both payment aggregates are empty", async () => {
    mocks.transaction.mockResolvedValue([0, 0, 0, 0, { _sum: { buyerTotalCents: null } }, { _sum: { amountCents: null } }]);
    expect(await getVendorDashboardStats("business-empty")).toEqual({
      activeServices: 0, openRequests: 0, activeBookings: 0, revenueCents: 0
    });
  });
});
