import {
  ListingFeeEventType,
  ListingStatus,
  OffsiteAdsTier,
  OrderStatus,
  PayoutStatus,
  PrismaClient,
  Prisma,
  RefundStatus
} from "@prisma/client";
import { addDays } from "date-fns";
import { scheduleReviewRemindersForCompletedOrder } from "@/lib/services/reviews";

type DbClient = Prisma.TransactionClient | PrismaClient;

type OrderFeeInput = {
  itemSubtotalCents: number;
  shippingAmountCents: number;
  taxAmountCents: number;
  giftWrapAmountCents: number;
  buyerTotalCents: number;
  taxRemittedByMarketplace: boolean;
  listingFeeCents: number;
  offsiteAdsAttributed: boolean;
  offsiteAdsTier: OffsiteAdsTier;
};

export type CalculatedOrderFees = {
  itemSubtotalCents: number;
  shippingAmountCents: number;
  taxAmountCents: number;
  giftWrapAmountCents: number;
  listingFeeCents: number;
  transactionFeeCents: number;
  paymentProcessingFeeCents: number;
  offsiteAdsFeeCents: number;
  totalFeesCents: number;
  sellerNetPayoutCents: number;
  lineItemsJson: {
    listing_fee: number;
    transaction_fee: number;
    payment_processing_fee: number;
    offsite_ads_fee: number;
  };
};

export async function getMarketplaceFeeConfig(client?: DbClient) {
  const resolvedClient = client ?? (await import("@/lib/db")).db;
  return resolvedClient.marketplaceFeeConfig.upsert({
    where: { singletonKey: "default" },
    update: {},
    create: {}
  });
}

export async function ensureSellerAccountForVendorProfile(
  vendorProfileId: string,
  client?: DbClient
) {
  const resolvedClient = client ?? (await import("@/lib/db")).db;
  const vendorProfile = await resolvedClient.vendorProfile.findUnique({
    where: { id: vendorProfileId }
  });

  if (!vendorProfile) {
    throw new Error("Vendor profile not found");
  }

  const seller = await resolvedClient.seller.upsert({
    where: { userId: vendorProfile.userId },
    update: {},
    create: {
      userId: vendorProfile.userId
    }
  });

  const shopSlug = await getAvailableShopSlug(
    resolvedClient,
    vendorProfile.slug,
    vendorProfile.id
  );

  const shop = await resolvedClient.shop.upsert({
    where: { vendorProfileId: vendorProfile.id },
    update: {
      name: vendorProfile.name,
      slug: shopSlug
    },
    create: {
      sellerId: seller.id,
      vendorProfileId: vendorProfile.id,
      name: vendorProfile.name,
      slug: shopSlug
    }
  });

  const patchedSeller =
    seller.defaultShopId === shop.id
      ? seller
      : await resolvedClient.seller.update({
          where: { id: seller.id },
          data: { defaultShopId: shop.id }
        });

  return { seller: patchedSeller, shop, vendorProfile };
}

async function getAvailableShopSlug(
  client: DbClient,
  preferredSlug: string,
  vendorProfileId: string
) {
  const candidates = [
    preferredSlug,
    `${preferredSlug}-${vendorProfileId.slice(-6)}`,
    `${preferredSlug}-${vendorProfileId.slice(-10)}`
  ];

  for (const slug of candidates) {
    const existing = await client.shop.findUnique({
      where: { slug },
      select: { vendorProfileId: true }
    });

    if (!existing || existing.vendorProfileId === vendorProfileId) {
      return slug;
    }
  }

  return `${preferredSlug}-${Date.now()}`;
}

export async function createListing(
  input: {
    vendorProfileId: string;
    offeringId?: string;
    title: string;
    category: string;
    description: string;
    priceFrom?: number | null;
    city: string;
    quantity?: number | null;
    autoRenew?: boolean;
    publish?: boolean;
  }
) {
  const { db } = await import("@/lib/db");
  return db.$transaction(async (tx) => {
    const config = await getMarketplaceFeeConfig(tx);
    const { seller, shop } = await ensureSellerAccountForVendorProfile(input.vendorProfileId, tx);
    const quantity = Math.max(1, input.quantity ?? 1);
    const existing = input.offeringId
      ? await tx.listing.findUnique({ where: { offeringId: input.offeringId } })
      : null;
    const shouldPublish = input.publish ?? true;
    const now = new Date();

    const listing = existing
      ? await tx.listing.update({
          where: { id: existing.id },
          data: {
            sellerId: seller.id,
            shopId: shop.id,
            title: input.title,
            category: input.category,
            description: input.description,
            priceFrom: input.priceFrom ?? null,
            city: input.city,
            quantity,
            availableQuantity:
              existing.availableQuantity > 0 ? existing.availableQuantity : quantity,
            autoRenew: input.autoRenew ?? existing.autoRenew,
            listingFeeFlatCents: config.listingFeeFlatCents,
            ...(shouldPublish && existing.status !== ListingStatus.ACTIVE
              ? {
                  status: ListingStatus.ACTIVE,
                  publishedAt: now,
                  expiresAt: addDays(now, config.listingDurationDays),
                  lastRenewedAt: now
                }
              : {})
          }
        })
      : await tx.listing.create({
          data: {
            sellerId: seller.id,
            shopId: shop.id,
            offeringId: input.offeringId,
            title: input.title,
            category: input.category,
            description: input.description,
            priceFrom: input.priceFrom ?? null,
            city: input.city,
            quantity,
            availableQuantity: quantity,
            autoRenew: input.autoRenew ?? false,
            listingFeeFlatCents: config.listingFeeFlatCents,
            status: shouldPublish ? ListingStatus.ACTIVE : ListingStatus.DRAFT,
            publishedAt: shouldPublish ? now : null,
            expiresAt: shouldPublish ? addDays(now, config.listingDurationDays) : null,
            lastRenewedAt: shouldPublish ? now : null
          }
        });

    if (shouldPublish && (!existing || existing.status !== ListingStatus.ACTIVE)) {
      await tx.listingFeeEvent.create({
        data: {
          listingId: listing.id,
          sellerId: seller.id,
          shopId: shop.id,
          eventType: ListingFeeEventType.PUBLISH,
          amountCents: config.listingFeeFlatCents,
          notes: "Listing fee charged when published. Non-refundable."
        }
      });
    }

    return listing;
  });
}

export async function renewListing(
  input: {
    listingId: string;
    eventType?: ListingFeeEventType;
    orderId?: string;
    replenishQuantity?: number;
  }
) {
  const { db } = await import("@/lib/db");
  return db.$transaction(async (tx) => {
    return renewListingInTx(tx, input);
  });
}

export async function calculateOrderFees(
  order: OrderFeeInput,
  seller: { offsiteAdsTier: OffsiteAdsTier; offsiteAdsEnabled: boolean },
  attribution: { attributed: boolean; tier?: OffsiteAdsTier } = { attributed: false },
  client?: DbClient
): Promise<CalculatedOrderFees> {
  const config = await getMarketplaceFeeConfig(client);
  return calculateOrderFeesFromConfig(order, seller, attribution, config);
}

export function calculateOrderFeesFromConfig(
  order: OrderFeeInput,
  seller: { offsiteAdsTier: OffsiteAdsTier; offsiteAdsEnabled: boolean },
  attribution: { attributed: boolean; tier?: OffsiteAdsTier },
  config: {
    transactionFeeBasisPoints: number;
    paymentProcessingBasisPoints: number;
    paymentProcessingFlatCents: number;
    offsiteAdsStandardBasisPoints: number;
    offsiteAdsHighVolumeBasisPoints: number;
    offsiteAdsEnabled: boolean;
  }
): CalculatedOrderFees {
  const transactionBase =
    order.itemSubtotalCents + order.shippingAmountCents + order.giftWrapAmountCents;
  const transactionFeeCents = percentageFee(
    transactionBase,
    config.transactionFeeBasisPoints
  );
  const paymentProcessingFeeCents =
    percentageFee(order.buyerTotalCents, config.paymentProcessingBasisPoints) +
    config.paymentProcessingFlatCents;

  const shouldChargeOffsiteAds =
    config.offsiteAdsEnabled && seller.offsiteAdsEnabled && attribution.attributed;
  const resolvedTier = attribution.tier ?? seller.offsiteAdsTier;
  const offsiteAdsBasisPoints =
    resolvedTier === OffsiteAdsTier.HIGH_VOLUME
      ? config.offsiteAdsHighVolumeBasisPoints
      : config.offsiteAdsStandardBasisPoints;
  const offsiteAdsFeeCents = shouldChargeOffsiteAds
    ? percentageFee(order.buyerTotalCents, offsiteAdsBasisPoints)
    : 0;

  const totalFeesCents =
    order.listingFeeCents +
    transactionFeeCents +
    paymentProcessingFeeCents +
    offsiteAdsFeeCents;
  const sellerNetPayoutCents =
    order.buyerTotalCents -
    (order.taxRemittedByMarketplace ? order.taxAmountCents : 0) -
    totalFeesCents;

  return {
    itemSubtotalCents: order.itemSubtotalCents,
    shippingAmountCents: order.shippingAmountCents,
    taxAmountCents: order.taxAmountCents,
    giftWrapAmountCents: order.giftWrapAmountCents,
    listingFeeCents: order.listingFeeCents,
    transactionFeeCents,
    paymentProcessingFeeCents,
    offsiteAdsFeeCents,
    totalFeesCents,
    sellerNetPayoutCents,
    lineItemsJson: {
      listing_fee: order.listingFeeCents,
      transaction_fee: transactionFeeCents,
      payment_processing_fee: paymentProcessingFeeCents,
      offsite_ads_fee: offsiteAdsFeeCents
    }
  };
}

export async function finalizeOrder(
  input: {
    orderId: string;
    status?: OrderStatus;
    paymentSucceeded?: boolean;
  }
) {
  const { db } = await import("@/lib/db");
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      include: {
        seller: true,
        listing: true,
        vendorProfile: true
      }
    });

    if (!order) {
      throw new Error("Order not found");
    }

    const { seller, shop } = await ensureSellerAccountForVendorProfile(order.vendorProfileId, tx);
    let listingFeeCents = 0;

    if (order.listingId && order.listing) {
      const nextAvailable = Math.max(order.listing.availableQuantity - 1, 0);

      if (order.listing.autoRenew) {
        const renewal = await renewListingInTx(tx, {
          listingId: order.listing.id,
          orderId: order.id,
          eventType:
            order.listing.quantity > 1
              ? ListingFeeEventType.SOLD_UNIT_RENEW
              : ListingFeeEventType.AUTO_RENEW,
          replenishQuantity: order.listing.quantity > 1 ? order.listing.quantity : 1
        });
        listingFeeCents = renewal.feeEvent.amountCents;
      } else {
        await tx.listing.update({
          where: { id: order.listing.id },
          data: {
            availableQuantity: nextAvailable,
            status: nextAvailable === 0 ? ListingStatus.SOLD : order.listing.status
          }
        });
      }
    }

    const buyerTotalCents =
      order.buyerTotalCents > 0
        ? order.buyerTotalCents
        : order.itemSubtotalCents +
          order.shippingAmountCents +
          order.giftWrapAmountCents +
          order.taxAmountCents;

    const fees = await calculateOrderFees(
      {
        itemSubtotalCents: order.itemSubtotalCents || order.amountCents,
        shippingAmountCents: order.shippingAmountCents,
        taxAmountCents: order.taxAmountCents,
        giftWrapAmountCents: order.giftWrapAmountCents,
        buyerTotalCents: buyerTotalCents || order.amountCents,
        taxRemittedByMarketplace: order.taxRemittedByMarketplace,
        listingFeeCents,
        offsiteAdsAttributed: order.offsiteAdsAttributed,
        offsiteAdsTier: order.offsiteAdsTier ?? seller.offsiteAdsTier
      },
      seller,
      {
        attributed: order.offsiteAdsAttributed,
        tier: order.offsiteAdsTier ?? seller.offsiteAdsTier
      },
      tx
    );

    const updatedOrder = await tx.order.update({
      where: { id: order.id },
      data: {
        sellerId: seller.id,
        shopId: shop.id,
        buyerTotalCents: buyerTotalCents || order.amountCents,
        paymentSucceededAt: input.paymentSucceeded ? new Date() : order.paymentSucceededAt,
        completedAt:
          input.status === OrderStatus.completed || order.status === OrderStatus.completed
            ? new Date()
            : order.completedAt,
        reviewEligibleAt:
          (input.status === OrderStatus.completed || order.status === OrderStatus.completed) &&
          (input.paymentSucceeded || Boolean(order.paymentSucceededAt))
            ? new Date()
            : order.reviewEligibleAt,
        status: input.status ?? order.status
      }
    });

    await tx.orderFeeBreakdown.upsert({
      where: { orderId: order.id },
      update: {
        itemSubtotalCents: fees.itemSubtotalCents,
        shippingAmountCents: fees.shippingAmountCents,
        taxAmountCents: fees.taxAmountCents,
        giftWrapAmountCents: fees.giftWrapAmountCents,
        listingFeeCents: fees.listingFeeCents,
        transactionFeeCents: fees.transactionFeeCents,
        paymentProcessingFeeCents: fees.paymentProcessingFeeCents,
        offsiteAdsFeeCents: fees.offsiteAdsFeeCents,
        totalFeesCents: fees.totalFeesCents,
        sellerNetPayoutCents: fees.sellerNetPayoutCents,
        adjustedItemSubtotalCents: fees.itemSubtotalCents,
        adjustedShippingAmountCents: fees.shippingAmountCents,
        adjustedTaxAmountCents: fees.taxAmountCents,
        adjustedGiftWrapAmountCents: fees.giftWrapAmountCents,
        adjustedListingFeeCents: fees.listingFeeCents,
        adjustedTransactionFeeCents: fees.transactionFeeCents,
        adjustedPaymentProcessingFeeCents: fees.paymentProcessingFeeCents,
        adjustedOffsiteAdsFeeCents: fees.offsiteAdsFeeCents,
        adjustedTotalFeesCents: fees.totalFeesCents,
        adjustedSellerNetPayoutCents: fees.sellerNetPayoutCents,
        lineItemsJson: fees.lineItemsJson
      },
      create: {
        orderId: order.id,
        itemSubtotalCents: fees.itemSubtotalCents,
        shippingAmountCents: fees.shippingAmountCents,
        taxAmountCents: fees.taxAmountCents,
        giftWrapAmountCents: fees.giftWrapAmountCents,
        listingFeeCents: fees.listingFeeCents,
        transactionFeeCents: fees.transactionFeeCents,
        paymentProcessingFeeCents: fees.paymentProcessingFeeCents,
        offsiteAdsFeeCents: fees.offsiteAdsFeeCents,
        totalFeesCents: fees.totalFeesCents,
        sellerNetPayoutCents: fees.sellerNetPayoutCents,
        adjustedItemSubtotalCents: fees.itemSubtotalCents,
        adjustedShippingAmountCents: fees.shippingAmountCents,
        adjustedTaxAmountCents: fees.taxAmountCents,
        adjustedGiftWrapAmountCents: fees.giftWrapAmountCents,
        adjustedListingFeeCents: fees.listingFeeCents,
        adjustedTransactionFeeCents: fees.transactionFeeCents,
        adjustedPaymentProcessingFeeCents: fees.paymentProcessingFeeCents,
        adjustedOffsiteAdsFeeCents: fees.offsiteAdsFeeCents,
        adjustedTotalFeesCents: fees.totalFeesCents,
        adjustedSellerNetPayoutCents: fees.sellerNetPayoutCents,
        lineItemsJson: fees.lineItemsJson
      }
    });

    const payout = await generateSellerPayout(order.id, tx);
    if (updatedOrder.reviewEligibleAt) {
      await scheduleReviewRemindersForCompletedOrder(order.id, tx);
    }
    return { order: updatedOrder, feeBreakdown: fees, payout };
  });
}

export async function issueRefund(
  input: {
    orderId: string;
    refundAmountCents: number;
    reason?: string;
  }
) {
  const { db } = await import("@/lib/db");
  return db.$transaction(async (tx) => {
    const config = await getMarketplaceFeeConfig(tx);
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      include: {
        seller: true,
        feeBreakdown: true
      }
    });

    if (!order?.seller || !order.feeBreakdown) {
      throw new Error("Order fee breakdown not found");
    }

    const buyerTotal = order.buyerTotalCents || order.amountCents;
    const refundRatio = Math.min(1, input.refundAmountCents / Math.max(buyerTotal, 1));
    const remainingRatio = 1 - refundRatio;
    const breakdown = order.feeBreakdown;
    const adjustedTransactionFeeCents = config.transactionFeeRefundable
      ? scaleCents(breakdown.transactionFeeCents, remainingRatio)
      : breakdown.transactionFeeCents;
    const adjustedPaymentProcessingFeeCents = config.paymentProcessingFeeRefundable
      ? scaleCents(breakdown.paymentProcessingFeeCents, remainingRatio)
      : breakdown.paymentProcessingFeeCents;
    const adjustedOffsiteAdsFeeCents = scaleCents(
      breakdown.offsiteAdsFeeCents,
      remainingRatio
    );
    const adjustedTotalBuyerCents = Math.max(0, buyerTotal - input.refundAmountCents);
    const adjustedTaxAmountCents = scaleCents(breakdown.taxAmountCents, remainingRatio);
    const adjustedFees =
      breakdown.listingFeeCents +
      adjustedTransactionFeeCents +
      adjustedPaymentProcessingFeeCents +
      adjustedOffsiteAdsFeeCents;
    const adjustedSellerNetPayoutCents =
      adjustedTotalBuyerCents -
      (order.taxRemittedByMarketplace ? adjustedTaxAmountCents : 0) -
      adjustedFees;

    const refund = await tx.refund.create({
      data: {
        orderId: order.id,
        sellerId: order.seller.id,
        amountCents: input.refundAmountCents,
        reason: input.reason ?? null,
        status: RefundStatus.COMPLETED,
        isFullRefund: input.refundAmountCents >= buyerTotal,
        transactionFeeAdjustmentCents:
          breakdown.transactionFeeCents - adjustedTransactionFeeCents,
        paymentProcessingFeeAdjustmentCents:
          breakdown.paymentProcessingFeeCents - adjustedPaymentProcessingFeeCents,
        offsiteAdsFeeAdjustmentCents: breakdown.offsiteAdsFeeCents - adjustedOffsiteAdsFeeCents,
        sellerNetAdjustmentCents:
          breakdown.sellerNetPayoutCents - adjustedSellerNetPayoutCents,
        originalFeeValuesJson: breakdown.lineItemsJson ?? Prisma.JsonNull,
        adjustedFeeValuesJson: {
          listing_fee: breakdown.listingFeeCents,
          transaction_fee: adjustedTransactionFeeCents,
          payment_processing_fee: adjustedPaymentProcessingFeeCents,
          offsite_ads_fee: adjustedOffsiteAdsFeeCents
        }
      }
    });

    await tx.orderFeeBreakdown.update({
      where: { orderId: order.id },
      data: {
        adjustedItemSubtotalCents: scaleCents(breakdown.itemSubtotalCents, remainingRatio),
        adjustedShippingAmountCents: scaleCents(
          breakdown.shippingAmountCents,
          remainingRatio
        ),
        adjustedTaxAmountCents,
        adjustedGiftWrapAmountCents: scaleCents(
          breakdown.giftWrapAmountCents,
          remainingRatio
        ),
        adjustedListingFeeCents: breakdown.listingFeeCents,
        adjustedTransactionFeeCents,
        adjustedPaymentProcessingFeeCents,
        adjustedOffsiteAdsFeeCents,
        adjustedTotalFeesCents: adjustedFees,
        adjustedSellerNetPayoutCents,
        refundedAmountCents: breakdown.refundedAmountCents + input.refundAmountCents
      }
    });

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: input.refundAmountCents >= buyerTotal ? OrderStatus.refunded : order.status
      }
    });

    return refund;
  });
}

export async function generateSellerPayout(orderId: string, client?: DbClient) {
  const resolvedClient = client ?? (await import("@/lib/db")).db;
  const order = await resolvedClient.order.findUnique({
    where: { id: orderId },
    include: {
      seller: true,
      feeBreakdown: true
    }
  });

  if (!order?.seller || !order.feeBreakdown) {
    throw new Error("Order fee breakdown not ready");
  }

  return resolvedClient.payout.upsert({
    where: { orderId: order.id },
    update: {
      sellerId: order.seller.id,
      shopId: order.shopId,
      grossAmountCents: order.buyerTotalCents || order.amountCents,
      totalFeesCents: order.feeBreakdown.adjustedTotalFeesCents,
      netAmountCents: order.feeBreakdown.adjustedSellerNetPayoutCents,
      status:
        order.status === OrderStatus.paid || order.status === OrderStatus.completed
          ? PayoutStatus.READY
          : PayoutStatus.PENDING
    },
    create: {
      sellerId: order.seller.id,
      shopId: order.shopId,
      orderId: order.id,
      grossAmountCents: order.buyerTotalCents || order.amountCents,
      totalFeesCents: order.feeBreakdown.adjustedTotalFeesCents,
      netAmountCents: order.feeBreakdown.adjustedSellerNetPayoutCents,
      status:
        order.status === OrderStatus.paid || order.status === OrderStatus.completed
          ? PayoutStatus.READY
          : PayoutStatus.PENDING
    }
  });
}

function percentageFee(amountCents: number, basisPoints: number) {
  return Math.round((amountCents * basisPoints) / 10_000);
}

function scaleCents(amountCents: number, ratio: number) {
  return Math.max(0, Math.round(amountCents * ratio));
}

async function renewListingInTx(
  tx: Prisma.TransactionClient,
  input: {
    listingId: string;
    eventType?: ListingFeeEventType;
    orderId?: string;
    replenishQuantity?: number;
  }
) {
  const config = await getMarketplaceFeeConfig(tx);
  const listing = await tx.listing.findUnique({
    where: { id: input.listingId }
  });

  if (!listing || !listing.sellerId) {
    throw new Error("Listing not found");
  }

  const now = new Date();
  const availableQuantity = input.replenishQuantity ?? listing.quantity;

  const updatedListing = await tx.listing.update({
    where: { id: listing.id },
    data: {
      status: ListingStatus.ACTIVE,
      publishedAt: now,
      expiresAt: addDays(now, config.listingDurationDays),
      lastRenewedAt: now,
      availableQuantity
    }
  });

  const feeEvent = await tx.listingFeeEvent.create({
    data: {
      listingId: listing.id,
      sellerId: listing.sellerId,
      shopId: listing.shopId,
      orderId: input.orderId,
      eventType: input.eventType ?? ListingFeeEventType.MANUAL_RENEW,
      amountCents: config.listingFeeFlatCents,
      notes: "Listing renewed under marketplace fee policy."
    }
  });

  return { listing: updatedListing, feeEvent };
}
