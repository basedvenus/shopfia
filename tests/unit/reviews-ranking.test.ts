import { describe, expect, it } from "vitest";
import { calculateRankingScore } from "@/lib/services/reviews";

describe("reviews ranking", () => {
  it("rewards verified review volume, strong rating, and completion rate", () => {
    const result = calculateRankingScore(
      {
        reviewCount: 25,
        averageRating: 4.9,
        recentReviews: 6,
        completionRate: 0.96,
        responseRate: 0.8,
        onTimeDeliveryRate: 0.95
      },
      {
        reviewCountWeight: 3,
        averageRatingWeight: 4,
        recentReviewsWeight: 2,
        completionRateWeight: 2,
        responseRateWeight: 1,
        onTimeDeliveryWeight: 1,
        minimumReviewsForBoost: 3
      }
    );

    expect(result.score).toBeGreaterThan(40);
    expect(result.tierLabel).toBe("Star Seller");
  });

  it("withholds the review-count boost until minimum review threshold is met", () => {
    const result = calculateRankingScore(
      {
        reviewCount: 2,
        averageRating: 5,
        recentReviews: 2,
        completionRate: 1,
        responseRate: 1,
        onTimeDeliveryRate: 1
      },
      {
        reviewCountWeight: 3,
        averageRatingWeight: 4,
        recentReviewsWeight: 2,
        completionRateWeight: 2,
        responseRateWeight: 1,
        onTimeDeliveryWeight: 1,
        minimumReviewsForBoost: 3
      }
    );

    expect(result.reviewCountComponent).toBe(0);
  });
});
