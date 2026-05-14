import { z } from "zod";

export const exploreSearchSchema = z.object({
  q: z.string().optional(),
  city: z.string().optional(),
  zip: z.string().optional(),
  categoryId: z.string().cuid().optional(),
  eventCategoryId: z.string().min(1).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  availableWeekend: z.enum(["true", "false"]).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  radius: z.coerce.number().int().min(1).max(200).optional(),
  sort: z.enum(["recommended", "distance", "top-rated", "newest"]).optional()
});
