"use server";

import { revalidatePath } from "next/cache";
import { OrderStatus, UserRole } from "@prisma/client";
import { requireRole, requireVerifiedVendorProfile } from "@/lib/auth/guards";
import { finalizeOrder, issueRefund } from "@/lib/services/marketplace-fees";

export async function updateOrderStatusAction(formData: FormData) {
  const { db } = await import("@/lib/db");
  const session = await requireRole([UserRole.VENDOR, UserRole.ADMIN]);
  if (session.user.role === UserRole.VENDOR) {
    await requireVerifiedVendorProfile(session.user.id);
  }
  const orderId = String(formData.get("orderId"));
  const status = String(formData.get("status")) as OrderStatus;

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
    if (
      session.user.role !== UserRole.ADMIN &&
      status === OrderStatus.canceled &&
      order.status === OrderStatus.completed
    ) {
      throw new Error("Completed orders cannot be canceled by vendor");
    }
    await db.order.update({
      where: { id: orderId },
      data: { status }
    });
  }

  revalidatePath("/vendor/dashboard");
  revalidatePath("/account");
}
