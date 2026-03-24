"use server";

import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { createVerifiedReview, respondToReview } from "@/lib/services/reviews";
import { createReviewSchema, reviewResponseSchema } from "@/lib/validators/review";

export async function createReviewAction(formData: FormData) {
  const session = await requireRole([UserRole.BUYER, UserRole.ADMIN]);
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
  const session = await requireRole([UserRole.VENDOR, UserRole.ADMIN]);
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
