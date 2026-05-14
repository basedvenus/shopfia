import { z } from "zod";

const optionalCoordinate = (min: number, max: number) =>
  z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number().min(min).max(max).optional()
  );

export const exploreSearchSchema = z.object({
  q: z.string().optional(),
  city: z.string().optional(),
  zip: z.string().optional(),
  placeId: z.string().optional(),
  locationLabel: z.string().optional(),
  lat: optionalCoordinate(-90, 90),
  lng: optionalCoordinate(-180, 180),
  categoryId: z.string().cuid().optional(),
  eventCategoryId: z.string().min(1).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  availableWeekend: z.enum(["true", "false"]).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  radius: z.coerce.number().int().min(1).max(200).optional(),
  verified: z.enum(["true"]).optional(),
  sort: z.enum(["recommended", "distance", "top-rated", "newest"]).optional()
});
