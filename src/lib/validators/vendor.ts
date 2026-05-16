import { z } from "zod";

const imageValueSchema = z
  .string()
  .max(5_000_000, "That image is too large. Try a smaller file.")
  .refine(
    (value) =>
      value === "" ||
      value.startsWith("data:image/") ||
      value.startsWith("/api/") ||
      z.string().url().safeParse(value).success,
    "Use an uploaded image or a valid image URL."
  );

const optionalCoordinate = (min: number, max: number) =>
  z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number().min(min).max(max).optional()
  );

export const vendorOnboardingSchema = z.object({
  name: z.string().min(2, "Business name is required.").max(80, "Business name is a little too long."),
  slug: z.string().min(2, "Vendor username is required.").max(80, "Vendor username is a little too long.").regex(/^[a-z0-9-]+$/, "Use letters, numbers, and dashes only."),
  username: z
    .string()
    .min(3, "Vendor username is required.")
    .max(40, "Vendor username is a little too long.")
    .regex(/^[a-z0-9._-]+$/, "Use letters, numbers, dots, dashes, or underscores."),
  website: z.string().url("Enter a valid website link.").optional().or(z.literal("")),
  instagramUrl: z.string().url("Enter a valid Instagram link.").optional().or(z.literal("")),
  tiktokUrl: z.string().url("Enter a valid TikTok link.").optional().or(z.literal("")),
  bio: z.string().max(600, "Business description is a little too long.").optional().or(z.literal("")),
  formattedAddress: z.string().max(240, "Business location is a little too long.").optional().or(z.literal("")),
  city: z.string().min(2, "City is required.").max(80, "City is a little too long."),
  state: z.string().max(40, "State is a little too long.").optional().or(z.literal("")),
  zipCode: z.string().max(12, "Zip code is a little too long.").optional().or(z.literal("")),
  locationLat: optionalCoordinate(-90, 90),
  locationLng: optionalCoordinate(-180, 180),
  googlePlaceId: z.string().max(180, "Location details are a little too long.").optional().or(z.literal("")),
  serviceRadiusMiles: z.coerce.number().int().min(1).max(200).optional().default(25),
  weekendAvailable: z.coerce.boolean().optional().default(true),
  serviceAreaNotes: z.string().max(500, "Service area notes are a little too long.").optional().or(z.literal("")),
  availabilityNotes: z.string().max(300, "Availability notes are a little too long.").optional().or(z.literal("")),
  logoUrl: imageValueSchema.optional().or(z.literal("")),
  categoryIds: z.array(z.string().cuid()).max(12, "Choose up to 12 categories.").default([]),
  photoUrls: z.array(imageValueSchema).max(8, "Add up to 8 photos.").default([])
});

const pricedOptionSchema = z.object({
  name: z.string().min(1, "Add a package or add-on name.").max(80, "Package name is a little too long."),
  description: z.string().max(240, "Description is a little too long.").optional().or(z.literal("")),
  priceCents: z.coerce.number().int().min(0).optional()
});

export const offeringSchema = z.object({
  id: z.string().cuid().optional(),
  type: z.enum(["SERVICE", "PRODUCT", "CUSTOM_ORDER"]),
  title: z.string().min(2, "Offering title is required.").max(120, "Offering title is a little too long."),
  slug: z.string().min(2, "Offering link is required.").max(120, "Offering link is a little too long.").regex(/^[a-z0-9-]+$/, "Use letters, numbers, and dashes only."),
  description: z.string().min(20, "Add a little more detail about this offering.").max(4000, "Offering description is a little too long."),
  basePriceCents: z.coerce.number().int().min(0).optional(),
  messageForPricing: z.coerce.boolean().optional().default(false),
  categoryId: z.string().cuid(),
  eventCategoryIds: z.array(z.string().min(1)).max(12, "Choose up to 12 event types.").default([]),
  tags: z.array(z.string().min(1).max(30, "Keep tags short and sweet.")).max(12, "Use up to 12 tags.").default([]),
  photos: z.array(imageValueSchema).max(10, "Add up to 10 photos.").default([]),
  packages: z.array(pricedOptionSchema).max(8, "Add up to 8 packages.").default([]),
  addons: z.array(pricedOptionSchema).max(12, "Add up to 12 add-ons.").default([]),
  durationMinutes: z.coerce.number().int().min(15).max(1440).optional(),
  turnaroundDays: z.coerce.number().int().min(0).max(365).optional(),
  inventoryCount: z.coerce.number().int().min(0).max(100000).optional(),
  allowInstantBook: z.coerce.boolean().optional().default(false),
  autoRenewListing: z.coerce.boolean().optional().default(false)
});

export const marketplaceFeeConfigSchema = z.object({
  listingFeeFlat: z.coerce.number().min(0),
  listingDurationDays: z.coerce.number().int().min(1),
  transactionFeePercent: z.coerce.number().min(0),
  paymentProcessingPercent: z.coerce.number().min(0),
  paymentProcessingFlat: z.coerce.number().min(0),
  offsiteAdsStandardPercent: z.coerce.number().min(0),
  offsiteAdsHighVolumePercent: z.coerce.number().min(0),
  offsiteAdsEnabled: z.coerce.boolean(),
  transactionFeeRefundable: z.coerce.boolean().default(true),
  paymentProcessingFeeRefundable: z.coerce.boolean().default(false)
});

export const rankingConfigSchema = z.object({
  rankingReviewCountWeight: z.coerce.number().min(0),
  rankingAverageRatingWeight: z.coerce.number().min(0),
  rankingRecentReviewsWeight: z.coerce.number().min(0),
  rankingCompletionRateWeight: z.coerce.number().min(0),
  rankingResponseRateWeight: z.coerce.number().min(0),
  rankingOnTimeDeliveryWeight: z.coerce.number().min(0),
  rankingRecencyWindowDays: z.coerce.number().int().min(1),
  rankingMinimumReviewsForBoost: z.coerce.number().int().min(0),
  fraudReviewVelocityThreshold: z.coerce.number().int().min(1),
  fraudLowRatingSpikeThreshold: z.coerce.number().int().min(1)
});
