"use server";

import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { getMarketplaceFeeConfig } from "@/lib/services/marketplace-fees";
import { marketplaceFeeConfigSchema, rankingConfigSchema } from "@/lib/validators/vendor";

export async function setVendorModerationAction(formData: FormData) {
  await requireRole([UserRole.ADMIN]);
  const vendorId = String(formData.get("vendorId"));
  const mode = String(formData.get("mode"));
  if (!vendorId || !["approve", "suspend"].includes(mode)) {
    throw new Error("Invalid moderation payload");
  }

  await db.vendorProfile.update({
    where: { id: vendorId },
    data: { verified: mode === "approve" }
  });

  revalidatePath("/admin");
  revalidatePath("/explore");
}

export async function removeOfferingAction(formData: FormData) {
  await requireRole([UserRole.ADMIN]);
  const offeringId = String(formData.get("offeringId"));
  await db.offering.update({ where: { id: offeringId }, data: { active: false } });
  revalidatePath("/admin");
  revalidatePath("/explore");
}

export async function updateMarketplaceFeeConfigAction(formData: FormData) {
  await requireRole([UserRole.ADMIN]);
  const parsed = marketplaceFeeConfigSchema.parse({
    listingFeeFlat: formData.get("listingFeeFlat"),
    listingDurationDays: formData.get("listingDurationDays"),
    transactionFeePercent: formData.get("transactionFeePercent"),
    paymentProcessingPercent: formData.get("paymentProcessingPercent"),
    paymentProcessingFlat: formData.get("paymentProcessingFlat"),
    offsiteAdsStandardPercent: formData.get("offsiteAdsStandardPercent"),
    offsiteAdsHighVolumePercent: formData.get("offsiteAdsHighVolumePercent"),
    offsiteAdsEnabled: formData.get("offsiteAdsEnabled") === "on",
    transactionFeeRefundable: formData.get("transactionFeeRefundable") === "on",
    paymentProcessingFeeRefundable: formData.get("paymentProcessingFeeRefundable") === "on"
  });
  const ranking = rankingConfigSchema.parse({
    rankingReviewCountWeight: formData.get("rankingReviewCountWeight"),
    rankingAverageRatingWeight: formData.get("rankingAverageRatingWeight"),
    rankingRecentReviewsWeight: formData.get("rankingRecentReviewsWeight"),
    rankingCompletionRateWeight: formData.get("rankingCompletionRateWeight"),
    rankingResponseRateWeight: formData.get("rankingResponseRateWeight"),
    rankingOnTimeDeliveryWeight: formData.get("rankingOnTimeDeliveryWeight"),
    rankingRecencyWindowDays: formData.get("rankingRecencyWindowDays"),
    rankingMinimumReviewsForBoost: formData.get("rankingMinimumReviewsForBoost"),
    fraudReviewVelocityThreshold: formData.get("fraudReviewVelocityThreshold"),
    fraudLowRatingSpikeThreshold: formData.get("fraudLowRatingSpikeThreshold")
  });

  const current = await getMarketplaceFeeConfig();
  await db.marketplaceFeeConfig.update({
    where: { id: current.id },
    data: {
      listingFeeFlatCents: Math.round(parsed.listingFeeFlat * 100),
      listingDurationDays: parsed.listingDurationDays,
      transactionFeeBasisPoints: Math.round(parsed.transactionFeePercent * 100),
      paymentProcessingBasisPoints: Math.round(parsed.paymentProcessingPercent * 100),
      paymentProcessingFlatCents: Math.round(parsed.paymentProcessingFlat * 100),
      offsiteAdsStandardBasisPoints: Math.round(parsed.offsiteAdsStandardPercent * 100),
      offsiteAdsHighVolumeBasisPoints: Math.round(parsed.offsiteAdsHighVolumePercent * 100),
      offsiteAdsEnabled: parsed.offsiteAdsEnabled,
      transactionFeeRefundable: parsed.transactionFeeRefundable,
      paymentProcessingFeeRefundable: parsed.paymentProcessingFeeRefundable,
      rankingReviewCountWeight: ranking.rankingReviewCountWeight,
      rankingAverageRatingWeight: ranking.rankingAverageRatingWeight,
      rankingRecentReviewsWeight: ranking.rankingRecentReviewsWeight,
      rankingCompletionRateWeight: ranking.rankingCompletionRateWeight,
      rankingResponseRateWeight: ranking.rankingResponseRateWeight,
      rankingOnTimeDeliveryWeight: ranking.rankingOnTimeDeliveryWeight,
      rankingRecencyWindowDays: ranking.rankingRecencyWindowDays,
      rankingMinimumReviewsForBoost: ranking.rankingMinimumReviewsForBoost,
      fraudReviewVelocityThreshold: ranking.fraudReviewVelocityThreshold,
      fraudLowRatingSpikeThreshold: ranking.fraudLowRatingSpikeThreshold
    }
  });

  revalidatePath("/admin");
  revalidatePath("/onboarding");
  revalidatePath("/vendor/dashboard");
}
