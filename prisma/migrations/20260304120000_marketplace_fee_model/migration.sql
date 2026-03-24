-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRED', 'SOLD', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ListingFeeEventType" AS ENUM ('PUBLISH', 'MANUAL_RENEW', 'AUTO_RENEW', 'SOLD_UNIT_RENEW');

-- CreateEnum
CREATE TYPE "OffsiteAdsTier" AS ENUM ('STANDARD', 'HIGH_VOLUME');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'READY', 'PAID', 'CANCELED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "Listing"
ADD COLUMN "autoRenew" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "availableQuantity" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "expiresAt" TIMESTAMP(3),
ADD COLUMN "lastRenewedAt" TIMESTAMP(3),
ADD COLUMN "listingFeeFlatCents" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN "offeringId" TEXT,
ADD COLUMN "publishedAt" TIMESTAMP(3),
ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "sellerId" TEXT,
ADD COLUMN "shopId" TEXT,
ADD COLUMN "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Order"
ADD COLUMN "buyerTotalCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "completedAt" TIMESTAMP(3),
ADD COLUMN "giftWrapAmountCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "itemSubtotalCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "listingId" TEXT,
ADD COLUMN "offsiteAdsAttributed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "offsiteAdsTier" "OffsiteAdsTier",
ADD COLUMN "paymentSucceededAt" TIMESTAMP(3),
ADD COLUMN "sellerId" TEXT,
ADD COLUMN "shippingAmountCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "shopId" TEXT,
ADD COLUMN "taxAmountCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "taxRemittedByMarketplace" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Seller" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "defaultShopId" TEXT,
    "offsiteAdsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "offsiteAdsTier" "OffsiteAdsTier" NOT NULL DEFAULT 'STANDARD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Seller_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "vendorProfileId" TEXT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "noMonthlySubscription" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingFeeEvent" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "shopId" TEXT,
    "orderId" TEXT,
    "eventType" "ListingFeeEventType" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "notes" TEXT,
    "chargedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ListingFeeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderFeeBreakdown" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "itemSubtotalCents" INTEGER NOT NULL,
    "shippingAmountCents" INTEGER NOT NULL,
    "taxAmountCents" INTEGER NOT NULL,
    "giftWrapAmountCents" INTEGER NOT NULL,
    "listingFeeCents" INTEGER NOT NULL,
    "transactionFeeCents" INTEGER NOT NULL,
    "paymentProcessingFeeCents" INTEGER NOT NULL,
    "offsiteAdsFeeCents" INTEGER NOT NULL,
    "totalFeesCents" INTEGER NOT NULL,
    "sellerNetPayoutCents" INTEGER NOT NULL,
    "adjustedItemSubtotalCents" INTEGER NOT NULL,
    "adjustedShippingAmountCents" INTEGER NOT NULL,
    "adjustedTaxAmountCents" INTEGER NOT NULL,
    "adjustedGiftWrapAmountCents" INTEGER NOT NULL,
    "adjustedListingFeeCents" INTEGER NOT NULL,
    "adjustedTransactionFeeCents" INTEGER NOT NULL,
    "adjustedPaymentProcessingFeeCents" INTEGER NOT NULL,
    "adjustedOffsiteAdsFeeCents" INTEGER NOT NULL,
    "adjustedTotalFeesCents" INTEGER NOT NULL,
    "adjustedSellerNetPayoutCents" INTEGER NOT NULL,
    "refundedAmountCents" INTEGER NOT NULL DEFAULT 0,
    "lineItemsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderFeeBreakdown_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "shopId" TEXT,
    "orderId" TEXT NOT NULL,
    "grossAmountCents" INTEGER NOT NULL,
    "totalFeesCents" INTEGER NOT NULL,
    "netAmountCents" INTEGER NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "reason" TEXT,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "isFullRefund" BOOLEAN NOT NULL DEFAULT false,
    "transactionFeeAdjustmentCents" INTEGER NOT NULL DEFAULT 0,
    "paymentProcessingFeeAdjustmentCents" INTEGER NOT NULL DEFAULT 0,
    "offsiteAdsFeeAdjustmentCents" INTEGER NOT NULL DEFAULT 0,
    "sellerNetAdjustmentCents" INTEGER NOT NULL DEFAULT 0,
    "originalFeeValuesJson" JSONB,
    "adjustedFeeValuesJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceFeeConfig" (
    "id" TEXT NOT NULL,
    "singletonKey" TEXT NOT NULL DEFAULT 'default',
    "listingFeeFlatCents" INTEGER NOT NULL DEFAULT 20,
    "listingDurationDays" INTEGER NOT NULL DEFAULT 120,
    "transactionFeeBasisPoints" INTEGER NOT NULL DEFAULT 650,
    "paymentProcessingBasisPoints" INTEGER NOT NULL DEFAULT 300,
    "paymentProcessingFlatCents" INTEGER NOT NULL DEFAULT 25,
    "offsiteAdsStandardBasisPoints" INTEGER NOT NULL DEFAULT 1500,
    "offsiteAdsHighVolumeBasisPoints" INTEGER NOT NULL DEFAULT 1200,
    "offsiteAdsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "transactionFeeRefundable" BOOLEAN NOT NULL DEFAULT true,
    "paymentProcessingFeeRefundable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketplaceFeeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Seller_userId_key" ON "Seller"("userId");
CREATE UNIQUE INDEX "Seller_defaultShopId_key" ON "Seller"("defaultShopId");
CREATE UNIQUE INDEX "Shop_vendorProfileId_key" ON "Shop"("vendorProfileId");
CREATE UNIQUE INDEX "Shop_slug_key" ON "Shop"("slug");
CREATE UNIQUE INDEX "Listing_offeringId_key" ON "Listing"("offeringId");
CREATE UNIQUE INDEX "OrderFeeBreakdown_orderId_key" ON "OrderFeeBreakdown"("orderId");
CREATE UNIQUE INDEX "Payout_orderId_key" ON "Payout"("orderId");
CREATE UNIQUE INDEX "MarketplaceFeeConfig_singletonKey_key" ON "MarketplaceFeeConfig"("singletonKey");

-- AddForeignKey
ALTER TABLE "Seller" ADD CONSTRAINT "Seller_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Seller" ADD CONSTRAINT "Seller_defaultShopId_fkey" FOREIGN KEY ("defaultShopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Shop" ADD CONSTRAINT "Shop_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Shop" ADD CONSTRAINT "Shop_vendorProfileId_fkey" FOREIGN KEY ("vendorProfileId") REFERENCES "VendorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "Offering"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ListingFeeEvent" ADD CONSTRAINT "ListingFeeEvent_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListingFeeEvent" ADD CONSTRAINT "ListingFeeEvent_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListingFeeEvent" ADD CONSTRAINT "ListingFeeEvent_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ListingFeeEvent" ADD CONSTRAINT "ListingFeeEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderFeeBreakdown" ADD CONSTRAINT "OrderFeeBreakdown_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;
