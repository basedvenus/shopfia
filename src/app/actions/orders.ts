"use server";

import { revalidatePath } from "next/cache";
import { OrderStatus, UserRole } from "@prisma/client";
import { requireRole, requireVerifiedVendorProfile } from "@/lib/auth/guards";
import { checkServerActionRateLimit } from "@/lib/security/request";
import { finalizeOrder, issueRefund } from "@/lib/services/marketplace-fees";

export async function updateOrderStatusAction(formData: FormData) {
  const { db } = await import("@/lib/db");
  const session = await requireRole([UserRole.VENDOR, UserRole.ADMIN]);
  const rate = await checkServerActionRateLimit([
    { key: "order-status:ip:{ip}", limit: 30, intervalMs: 60_000 },
    { key: `order-status:user:${session.user.id}`, limit: 18, intervalMs: 60_000 }
  ]);
  if (!rate.ok) throw new Error("Rate limit exceeded");

  if (session.user.role === UserRole.VENDOR) {
    await requireVerifiedVendorProfile(session.user.id);
  }
  const orderId = String(formData.get("orderId"));
  const status = String(formData.get("status")) as OrderStatus;
  if (!Object.values(OrderStatus).includes(status)) throw new Error("Invalid order status");

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { vendorProfile: true }
  });
  if (!order) throw new Error("Order not found");
  if (session.user.role !== UserRole.ADMIN && order.vendorId !== session.user.id) {
    throw new Error("Forbidden");
  }

  if (status === OrderStatus.paid) {
    throw new Error("Paid status is set by verified payment events only");
  }

  if (status === OrderStatus.refunded) {
    if (session.user.role !== UserRole.ADMIN) {
      throw new Error("Refunds must be handled by admin or payment provider flow");
    }
    await issueRefund({
      orderId,
      refundAmountCents: order.buyerTotalCents || order.amountCents,
      reason: "Refund issued from seller dashboard"
    });
  } else if (status === OrderStatus.completed) {
    if (!order.paymentSucceededAt) {
      throw new Error("Cannot complete an unpaid order");
    }
    await finalizeOrder({
      orderId,
      status,
      paymentSucceeded: false
    });
  } else {
    if (status === OrderStatus.in_progress && !order.paymentSucceededAt) {
      throw new Error("Cannot start an unpaid order");
    }
    if (status === OrderStatus.in_progress && (order.completedAt || order.status === OrderStatus.completed)) {
      throw new Error("Completed orders cannot be restarted");
    }
    if (
      order.paymentSucceededAt &&
      [OrderStatus.draft, OrderStatus.awaiting_vendor, OrderStatus.quoted, OrderStatus.awaiting_payment].includes(
        status as typeof OrderStatus.draft | typeof OrderStatus.awaiting_vendor | typeof OrderStatus.quoted | typeof OrderStatus.awaiting_payment
      )
    ) {
      throw new Error("A paid order cannot be reset to unpaid");
    }
    if (
      session.user.role !== UserRole.ADMIN &&
      status === OrderStatus.canceled &&
      order.status === OrderStatus.completed
    ) {
      throw new Error("Completed orders cannot be canceled by vendor");
    }
    const changed = await db.order.updateMany({
      where: { id: orderId, status: order.status, paymentSucceededAt: order.paymentSucceededAt },
      data: { status }
    });
    if (changed.count !== 1) throw new Error("The order changed. Please refresh before updating it.");
  }

  revalidatePath("/vendor/dashboard");
  revalidatePath("/account");
}
