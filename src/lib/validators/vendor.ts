import { z } from "zod";

export const vendorOnboardingSchema = z.object({
  name: z.string().min(2).max(80),
  slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/),
  username: z
    .string()
    .min(3)
    .max(40)
    .regex(/^[a-z0-9._-]+$/)
    .optional()
    .or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
  bio: z.string().max(600).optional().or(z.literal("")),
  city: z.string().min(2).max(80),
  state: z.string().max(40).optional().or(z.literal("")),
  zipCode: z.string().max(12).optional().or(z.literal("")),
  serviceRadiusMiles: z.coerce.number().int().min(1).max(200).optional().default(25),
  weekendAvailable: z.coerce.boolean().optional().default(true),
  serviceAreaNotes: z.string().max(500).optional().or(z.literal("")),
  availabilityNotes: z.string().max(300).optional().or(z.literal("")),
  logoUrl: z.string().max(1_500_000).optional().or(z.literal("")),
  categoryIds: z.array(z.string().cuid()).min(1),
  photoUrls: z.array(z.string().url()).max(8).default([])
});

export const offeringSchema = z.object({
  id: z.string().cuid().optional(),
  type: z.enum(["SERVICE", "PRODUCT"]),
  title: z.string().min(2).max(120),
  slug: z.string().min(2).max(120).regex(/^[a-z0-9-]+$/),
  description: z.string().min(20).max(4000),
  basePriceCents: z.coerce.number().int().min(0).optional(),
  categoryId: z.string().cuid(),
  tags: z.array(z.string().min(1).max(30)).max(12).default([]),
  photos: z.array(z.string().url()).max(10).default([]),
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
