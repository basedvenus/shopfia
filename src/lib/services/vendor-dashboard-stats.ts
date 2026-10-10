import { db } from "@/lib/db";

/** Totals cover the entire business, independently of the recent-activity page limit. */
export async function getVendorDashboardStats(vendorProfileId: string) {
  const paidWhere = {
    vendorProfileId,
    status: { in: ["paid", "in_progress", "completed"] as ("paid" | "in_progress" | "completed")[] },
    paymentSucceededAt: { not: null }
  };
  const [activeServices, standaloneInquiries, quoteRequests, activeBookings, totals, legacyTotals] = await db.$transaction([
    db.offering.count({ where: { vendorId: vendorProfileId, active: true } }),
    db.inquiry.count({ where: { vendorProfileId, status: "NEW", quoteRequest: { is: null } } }),
    db.quoteRequest.count({ where: { vendorId: vendorProfileId, status: { in: ["SUBMITTED", "RESPONDED"] } } }),
    db.order.count({ where: { vendorProfileId, status: { in: ["awaiting_payment", "paid", "in_progress"] } } }),
    db.order.aggregate({ where: { ...paidWhere, buyerTotalCents: { gt: 0 } }, _sum: { buyerTotalCents: true } }),
    db.order.aggregate({ where: { ...paidWhere, buyerTotalCents: { lte: 0 } }, _sum: { amountCents: true } })
  ], { isolationLevel: "RepeatableRead" });
  return {
    activeServices,
    openRequests: standaloneInquiries + quoteRequests,
    activeBookings,
    revenueCents: (totals._sum.buyerTotalCents ?? 0) + (legacyTotals._sum.amountCents ?? 0)
  };
}
