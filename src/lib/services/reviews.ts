import {
  OrderStatus,
  Prisma,
  ReviewReminderType
} from "@prisma/client";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { db } from "@/lib/db";

type DbClient = Prisma.TransactionClient | typeof db;

export async function assertReviewEligibility(
  orderId: string,
  buyerId: string,
  client: DbClient = db
) {
  const order = await client.order.findUnique({
    where: { id: orderId },
    include: {
      vendorProfile: true,
      review: {
        include: {
          response: true
        }
      }
    }
  });

  if (!order) throw new Error("Order not found");
  if (order.buyerId !== buyerId) throw new Error("Forbidden");
  if (order.status !== OrderStatus.completed) {
    throw new Error("Review allowed only for completed orders");
  }
  if (!order.paymentSucceededAt) {
    throw new Error("Reviews are only collected for bookings made through Fia");
  }

  return order;
}

export async function createVerifiedReview(input: {
  orderId: string;
  buyerId: string;
  rating: number;
  body?: string;
}) {
  const rate = checkRateLimit(`review:${input.buyerId}`, 4, 60 * 60 * 1000);
  if (!rate.ok) throw new Error("Too many review attempts. Try again later.");

  return db.$transaction(async (tx) => {
    const config = await tx.marketplaceFeeConfig.upsert({
      where: { singletonKey: "default" },
      update: {},
      create: {}
    });
    const order = await assertReviewEligibility(input.orderId, input.buyerId, tx);

    const recentBuyerReviews = await tx.review.count({
      where: {
        buyerId: input.buyerId,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    });
    const recentLowRatings = await tx.review.count({
      where: {
        vendorId: order.vendorProfileId,
        rating: { lte: 2 },
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    });
    const flaggedForModeration =
      recentBuyerReviews >= config.fraudReviewVelocityThreshold ||
      (input.rating <= 2 && recentLowRatings >= config.fraudLowRatingSpikeThreshold);

    const review = await tx.review.upsert({
      where: { orderId: order.id },
      update: {
        rating: input.rating,
        body: input.body || null,
        verifiedPurchase: true,
        reviewerDisplayLabel: "Verified Purchase",
        flaggedForModeration,
        flaggedReason: flaggedForModeration
          ? recentBuyerReviews >= config.fraudReviewVelocityThreshold
            ? "High review velocity from single buyer"
            : "Possible low-rating spike"
          : null
      },
      create: {
        orderId: order.id,
        buyerId: input.buyerId,
        vendorId: order.vendorProfileId,
        rating: input.rating,
        body: input.body || null,
        verifiedPurchase: true,
        reviewerDisplayLabel: "Verified Purchase",
        flaggedForModeration,
        flaggedReason: flaggedForModeration
          ? recentBuyerReviews >= config.fraudReviewVelocityThreshold
            ? "High review velocity from single buyer"
            : "Possible low-rating spike"
          : null
      }
    });

    await refreshSellerReviewMetrics(order.vendorProfileId, tx);
    return review;
  });
}

export async function respondToReview(input: {
  reviewId: string;
  sellerId: string;
  body: string;
}) {
  return db.$transaction(async (tx) => {
    const review = await tx.review.findUnique({
      where: { id: input.reviewId },
      include: {
        order: true
      }
    });

    if (!review) throw new Error("Review not found");
    if (review.order.sellerId !== input.sellerId) throw new Error("Forbidden");

    const response = await tx.reviewResponse.upsert({
      where: { reviewId: review.id },
      update: {
        body: input.body
      },
      create: {
        reviewId: review.id,
        sellerId: input.sellerId,
        body: input.body
      }
    });

    await refreshSellerReviewMetrics(review.vendorId, tx);
    return response;
  });
}

export async function refreshSellerReviewMetrics(
  vendorProfileId: string,
  client: DbClient = db
) {
  const config = await client.marketplaceFeeConfig.upsert({
    where: { singletonKey: "default" },
    update: {},
    create: {}
  });

  const reviews = await client.review.findMany({
    where: { vendorId: vendorProfileId },
    include: {
      response: true,
      order: true
    },
    orderBy: { createdAt: "desc" }
  });

  const totalReviews = reviews.length;
  const now = Date.now();
  const recentWindowMs = config.rankingRecencyWindowDays * 24 * 60 * 60 * 1000;
  const recentReviews = reviews.filter((review) => {
    return now - review.createdAt.getTime() <= recentWindowMs;
  });

  const weighted = reviews.reduce(
    (acc, review) => {
      const ageDays = Math.max(0, (now - review.createdAt.getTime()) / (24 * 60 * 60 * 1000));
      const weight = ageDays <= config.rankingRecencyWindowDays ? 1.15 : 1;
      return {
        rating: acc.rating + review.rating * weight,
        weight: acc.weight + weight
      };
    },
    { rating: 0, weight: 0 }
  );

  const averageRating =
    totalReviews > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews
      : 0;
  const weightedAverageRating = weighted.weight > 0 ? weighted.rating / weighted.weight : 0;
  const flaggedReviewCount = reviews.filter((review) => review.flaggedForModeration).length;
  const respondedCount = reviews.filter((review) => Boolean(review.response)).length;
  const responseRate = totalReviews > 0 ? respondedCount / totalReviews : 0;

  const completionStats = await client.order.aggregate({
    where: { vendorProfileId },
    _count: { _all: true }
  });
  const completedCount = await client.order.count({
    where: { vendorProfileId, status: OrderStatus.completed, paymentSucceededAt: { not: null } }
  });
  const completionRate =
    completionStats._count._all > 0 ? completedCount / completionStats._count._all : 0;

  const ranking = calculateRankingScore(
    {
      reviewCount: totalReviews,
      averageRating: weightedAverageRating || averageRating,
      recentReviews: recentReviews.length,
      completionRate,
      responseRate,
      onTimeDeliveryRate: 1
    },
    {
      reviewCountWeight: config.rankingReviewCountWeight,
      averageRatingWeight: config.rankingAverageRatingWeight,
      recentReviewsWeight: config.rankingRecentReviewsWeight,
      completionRateWeight: config.rankingCompletionRateWeight,
      responseRateWeight: config.rankingResponseRateWeight,
      onTimeDeliveryWeight: config.rankingOnTimeDeliveryWeight,
      minimumReviewsForBoost: config.rankingMinimumReviewsForBoost
    }
  );

  await client.sellerRatingAggregate.upsert({
    where: { vendorProfileId },
    update: {
      averageRating,
      weightedAverageRating,
      totalReviews,
      recentReviews30d: recentReviews.length,
      completionRate,
      responseRate,
      onTimeDeliveryRate: 1,
      flaggedReviewCount,
      lastReviewAt: reviews[0]?.createdAt ?? null
    },
    create: {
      vendorProfileId,
      averageRating,
      weightedAverageRating,
      totalReviews,
      recentReviews30d: recentReviews.length,
      completionRate,
      responseRate,
      onTimeDeliveryRate: 1,
      flaggedReviewCount,
      lastReviewAt: reviews[0]?.createdAt ?? null
    }
  });

  await client.rankingScore.upsert({
    where: { vendorProfileId },
    update: {
      score: ranking.score,
      reviewCountComponent: ranking.reviewCountComponent,
      ratingComponent: ranking.ratingComponent,
      recentReviewComponent: ranking.recentReviewComponent,
      completionComponent: ranking.completionComponent,
      responseComponent: ranking.responseComponent,
      onTimeDeliveryComponent: ranking.onTimeDeliveryComponent,
      tierLabel: ranking.tierLabel,
      calculatedAt: new Date()
    },
    create: {
      vendorProfileId,
      score: ranking.score,
      reviewCountComponent: ranking.reviewCountComponent,
      ratingComponent: ranking.ratingComponent,
      recentReviewComponent: ranking.recentReviewComponent,
      completionComponent: ranking.completionComponent,
      responseComponent: ranking.responseComponent,
      onTimeDeliveryComponent: ranking.onTimeDeliveryComponent,
      tierLabel: ranking.tierLabel,
      calculatedAt: new Date()
    }
  });

  await client.vendorProfile.update({
    where: { id: vendorProfileId },
    data: {
      averageRating,
      reviewCount: totalReviews
    }
  });
}

export function calculateRankingScore(
  input: {
    reviewCount: number;
    averageRating: number;
    recentReviews: number;
    completionRate: number;
    responseRate: number;
    onTimeDeliveryRate: number;
  },
  weights: {
    reviewCountWeight: number;
    averageRatingWeight: number;
    recentReviewsWeight: number;
    completionRateWeight: number;
    responseRateWeight: number;
    onTimeDeliveryWeight: number;
    minimumReviewsForBoost: number;
  }
) {
  const reviewCountComponent =
    input.reviewCount >= weights.minimumReviewsForBoost
      ? weights.reviewCountWeight * Math.log1p(input.reviewCount)
      : 0;
  const ratingComponent = weights.averageRatingWeight * input.averageRating;
  const recentReviewComponent = weights.recentReviewsWeight * input.recentReviews;
  const completionComponent = weights.completionRateWeight * input.completionRate;
  const responseComponent = weights.responseRateWeight * input.responseRate;
  const onTimeDeliveryComponent =
    weights.onTimeDeliveryWeight * input.onTimeDeliveryRate;
  const score =
    reviewCountComponent +
    ratingComponent +
    recentReviewComponent +
    completionComponent +
    responseComponent +
    onTimeDeliveryComponent;

  return {
    score,
    reviewCountComponent,
    ratingComponent,
    recentReviewComponent,
    completionComponent,
    responseComponent,
    onTimeDeliveryComponent,
    tierLabel:
      score >= 30 ? "Star Seller" : score >= 20 ? "Growing Fast" : score >= 10 ? "Rising" : "New"
  };
}

export async function scheduleReviewRemindersForCompletedOrder(
  orderId: string,
  client: DbClient = db
) {
  await client.reviewReminder.upsert({
    where: {
      orderId_reminderType: {
        orderId,
        reminderType: ReviewReminderType.FIRST_FOLLOW_UP
      }
    },
    update: {},
    create: {
      orderId,
      reminderType: ReviewReminderType.FIRST_FOLLOW_UP
    }
  });

  await client.reviewReminder.upsert({
    where: {
      orderId_reminderType: {
        orderId,
        reminderType: ReviewReminderType.SECOND_FOLLOW_UP
      }
    },
    update: {},
    create: {
      orderId,
      reminderType: ReviewReminderType.SECOND_FOLLOW_UP
    }
  });
}
