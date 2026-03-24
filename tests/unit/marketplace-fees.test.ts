import { describe, expect, it } from "vitest";
import { OffsiteAdsTier } from "@prisma/client";
import { calculateOrderFeesFromConfig } from "@/lib/services/marketplace-fees";

describe("marketplace fees", () => {
  const config = {
    transactionFeeBasisPoints: 650,
    paymentProcessingBasisPoints: 300,
    paymentProcessingFlatCents: 25,
    offsiteAdsStandardBasisPoints: 1500,
    offsiteAdsHighVolumeBasisPoints: 1200,
    offsiteAdsEnabled: true
  };

  it("calculates Etsy-style fees without charging transaction fee on tax", () => {
    const result = calculateOrderFeesFromConfig(
      {
        itemSubtotalCents: 10_000,
        shippingAmountCents: 1_500,
        taxAmountCents: 900,
        giftWrapAmountCents: 500,
        buyerTotalCents: 12_900,
        taxRemittedByMarketplace: true,
        listingFeeCents: 20,
        offsiteAdsAttributed: false,
        offsiteAdsTier: OffsiteAdsTier.STANDARD
      },
      { offsiteAdsEnabled: false, offsiteAdsTier: OffsiteAdsTier.STANDARD },
      { attributed: false },
      config
    );

    expect(result.transactionFeeCents).toBe(780);
    expect(result.paymentProcessingFeeCents).toBe(412);
    expect(result.offsiteAdsFeeCents).toBe(0);
    expect(result.totalFeesCents).toBe(1_212);
    expect(result.sellerNetPayoutCents).toBe(10_788);
  });

  it("uses the high-volume offsite ads rate only when attributed", () => {
    const result = calculateOrderFeesFromConfig(
      {
        itemSubtotalCents: 20_000,
        shippingAmountCents: 2_000,
        taxAmountCents: 0,
        giftWrapAmountCents: 0,
        buyerTotalCents: 22_000,
        taxRemittedByMarketplace: false,
        listingFeeCents: 20,
        offsiteAdsAttributed: true,
        offsiteAdsTier: OffsiteAdsTier.HIGH_VOLUME
      },
      { offsiteAdsEnabled: true, offsiteAdsTier: OffsiteAdsTier.HIGH_VOLUME },
      { attributed: true, tier: OffsiteAdsTier.HIGH_VOLUME },
      config
    );

    expect(result.offsiteAdsFeeCents).toBe(2_640);
    expect(result.lineItemsJson.offsite_ads_fee).toBe(2_640);
  });
});
