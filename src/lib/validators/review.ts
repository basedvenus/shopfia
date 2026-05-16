import { z } from "zod";

export const createReviewSchema = z.object({
  orderId: z.string().cuid(),
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().max(1000, "Review is a little too long.").optional().or(z.literal(""))
});

export const reviewResponseSchema = z.object({
  reviewId: z.string().cuid(),
  body: z.string().min(2, "Add a short response.").max(1000, "Response is a little too long.")
});
