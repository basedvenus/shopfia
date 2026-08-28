"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { businessManagerWhere } from "@/lib/businesses";
import { requireRole, requireSession } from "@/lib/auth/guards";
import { checkServerActionRateLimit } from "@/lib/security/request";
import { createVerifiedReview, respondToReview, scheduleReviewRemindersForCompletedOrder } from "@/lib/services/reviews";
import { createReviewSchema, reviewResponseSchema } from "@/lib/validators/review";

export async function createReviewAction(formData: FormData) {
  const { db } = await import("@/lib/db");
  const session = await requireRole([UserRole.BUYER, UserRole.ADMIN]);
  const rate = await checkServerActionRateLimit([
    { key: "review-create:ip:{ip}", limit: 15, intervalMs: 60_000 },
    { key: `review-create:user:${session.user.id}`, limit: 6, intervalMs: 60_000 }
  ]);
  if (!rate.ok) throw new Error("Rate limit exceeded");

  const parsed = createReviewSchema.parse({
    orderId: formData.get("orderId"),
    rating: formData.get("rating"),
    body: formData.get("body")
  });
  const review = await createVerifiedReview({
    orderId: parsed.orderId,
    buyerId: session.user.id,
    rating: parsed.rating,
    body: parsed.body || undefined
  });

  const order = await db.order.findUnique({
    where: { id: review.orderId },
    include: { vendorProfile: true }
  });
  if (!order) throw new Error("Order not found");

  revalidatePath("/account");
  revalidatePath("/vendor/dashboard");
  revalidatePath(`/vendor/profile/${order.vendorProfile.slug}`);
  revalidatePath("/explore");
}

export async function respondToReviewAction(formData: FormData) {
  const { db } = await import("@/lib/db");
  const session = await requireRole([UserRole.VENDOR, UserRole.ADMIN]);
  const rate = await checkServerActionRateLimit([
    { key: "review-response:ip:{ip}", limit: 20, intervalMs: 60_000 },
    { key: `review-response:user:${session.user.id}`, limit: 10, intervalMs: 60_000 }
  ]);
  if (!rate.ok) throw new Error("Rate limit exceeded");

  const parsed = reviewResponseSchema.parse({
    reviewId: formData.get("reviewId"),
    body: formData.get("body")
  });

  const vendor = await db.vendorProfile.findUnique({
    where: { userId: session.user.id },
    include: { shop: { include: { seller: true } } }
  });
  if (!vendor?.shop?.seller) throw new Error("Seller account not found");

  const response = await respondToReview({
    reviewId: parsed.reviewId,
    sellerId: vendor.shop.seller.id,
    body: parsed.body
  });

  const review = await db.review.findUnique({
    where: { id: response.reviewId },
    include: { vendor: true }
  });
  if (!review) throw new Error("Review not found");

  revalidatePath("/vendor/dashboard");
  revalidatePath(`/vendor/profile/${review.vendor.slug}`);
  revalidatePath("/explore");
}

export async function requestReviewForOrderAction(formData: FormData) {
  const { db } = await import("@/lib/db");
  const session = await requireSession();
  const orderId = String(formData.get("orderId") ?? "");
  const submittedReturnTo = String(formData.get("returnTo") ?? "/vendor/dashboard");
  const returnTo = submittedReturnTo.startsWith("/") && !submittedReturnTo.startsWith("//")
    ? submittedReturnTo
    : "/vendor/dashboard";

  const rate = await checkServerActionRateLimit([
    { key: "review-request:ip:{ip}", limit: 20, intervalMs: 60_000 },
    { key: `review-request:user:${session.user.id}`, limit: 8, intervalMs: 60_000 }
  ]);
  if (!rate.ok) redirect(`${returnTo}?reviewRequest=rate-limited`);

  const order = await db.order.findFirst({
    where: {
      id: orderId,
      status: "completed",
      paymentSucceededAt: { not: null },
      review: { is: null },
      vendorProfile: businessManagerWhere(session.user.id, session.user.role)
    },
    include: {
      buyer: { select: { id: true, name: true } },
      offering: { select: { title: true } },
      quote: {
        include: {
          quoteRequest: {
            select: {
              conversationId: true,
              eventDate: true,
              eventLocation: true
            }
          }
        }
      },
      vendorProfile: { select: { name: true, slug: true } }
    }
  });

  if (!order) redirect(`${returnTo}?reviewRequest=unavailable`);

  const conversationId = order.quote?.quoteRequest.conversationId ?? null;
  if (!conversationId) redirect(`${returnTo}?reviewRequest=no-conversation`);

  const context = order.offering?.title ?? order.quote?.quoteRequest.eventLocation ?? "your event";
  await db.message.create({
    data: {
      attachments: [],
      body: `Thank you again for booking ${context} with ${order.vendorProfile.name}. When you have a moment, could you leave a verified ShopFia review from your Account page? It helps future hosts feel confident booking us.`,
      conversationId,
      senderId: session.user.id
    }
  });
  await db.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() }
  });
  await scheduleReviewRemindersForCompletedOrder(order.id);

  revalidatePath("/messages");
  revalidatePath("/vendor/dashboard");
  revalidatePath(`/vendor/business/${order.vendorProfile.slug}`);
  redirect(`${returnTo}?reviewRequest=sent`);
}
