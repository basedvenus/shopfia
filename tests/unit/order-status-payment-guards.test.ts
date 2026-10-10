import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  db: { order: { findUnique: vi.fn(), updateMany: vi.fn() } },
  finalize: vi.fn(), refund: vi.fn()
}));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/auth/guards", () => ({ requireRole: async () => ({ user: { id: "vendor_test", role: "VENDOR" } }), requireVerifiedVendorProfile: vi.fn() }));
vi.mock("@/lib/security/request", () => ({ checkServerActionRateLimit: async () => ({ ok: true }) }));
vi.mock("@/lib/services/marketplace-fees", () => ({ finalizeOrder: mocks.finalize, issueRefund: mocks.refund }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { updateOrderStatusAction } from "@/app/actions/orders";
function form(status: string) { const data = new FormData(); data.set("orderId", "order_test"); data.set("status", status); return data; }
beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.order.findUnique.mockResolvedValue({ id: "order_test", vendorId: "vendor_test", status: "awaiting_payment", paymentSucceededAt: null });
  mocks.db.order.updateMany.mockResolvedValue({ count: 1 });
});
describe("order status preserves payment truth", () => {
  it("cannot start an unpaid order", async () => {
    await expect(updateOrderStatusAction(form("in_progress"))).rejects.toThrow(/unpaid/);
    expect(mocks.db.order.updateMany).not.toHaveBeenCalled();
  });
  it.each(["draft", "awaiting_vendor", "quoted", "awaiting_payment"])("cannot reset paid orders to %s", async (status) => {
    mocks.db.order.findUnique.mockResolvedValue({ id: "order_test", vendorId: "vendor_test", status: "paid", paymentSucceededAt: new Date() });
    await expect(updateOrderStatusAction(form(status))).rejects.toThrow(/reset to unpaid/);
    expect(mocks.db.order.updateMany).not.toHaveBeenCalled();
  });
  it("cannot restart an already completed order", async () => {
    mocks.db.order.findUnique.mockResolvedValue({ id: "order_test", vendorId: "vendor_test", status: "completed", paymentSucceededAt: new Date(), completedAt: new Date() });
    await expect(updateOrderStatusAction(form("in_progress"))).rejects.toThrow(/cannot be restarted/);
    expect(mocks.db.order.updateMany).not.toHaveBeenCalled();
  });
  it("does not overwrite a payment that won a concurrent state change", async () => {
    mocks.db.order.updateMany.mockResolvedValue({ count: 0 });
    await expect(updateOrderStatusAction(form("canceled"))).rejects.toThrow(/order changed/);
    expect(mocks.db.order.updateMany).toHaveBeenCalledWith({ where: { id: "order_test", status: "awaiting_payment", paymentSucceededAt: null }, data: { status: "canceled" } });
  });
  it("rejects invalid status values before database lookup", async () => {
    await expect(updateOrderStatusAction(form("not_a_status"))).rejects.toThrow(/Invalid order status/);
    expect(mocks.db.order.findUnique).not.toHaveBeenCalled();
  });
});
