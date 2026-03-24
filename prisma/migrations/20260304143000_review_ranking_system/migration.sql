-- CreateEnum
CREATE TYPE "ReviewReminderType" AS ENUM ('FIRST_FOLLOW_UP', 'SECOND_FOLLOW_UP');

-- AlterTable
ALTER TABLE "MarketplaceFeeConfig"
ADD COLUMN "fraudLowRatingSpikeThreshold" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN "fraudReviewVelocityThreshold" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN "rankingAverageRatingWeight" DOUBLE PRECISION NOT NULL DEFAULT 4,
ADD COLUMN "rankingCompletionRateWeight" DOUBLE PRECISION NOT NULL DEFAULT 2,
ADD COLUMN "rankingMinimumReviewsForBoost" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN "rankingOnTimeDeliveryWeight" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN "rankingRecencyWindowDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN "rankingRecentReviewsWeight" DOUBLE PRECISION NOT NULL DEFAULT 2,
ADD COLUMN "rankingResponseRateWeight" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN "rankingReviewCountWeight" DOUBLE PRECISION NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE "Order"
ADD COLUMN "reviewEligibleAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Review"
ADD COLUMN "flaggedForModeration" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "flaggedReason" TEXT,
ADD COLUMN "reviewerDisplayLabel" TEXT NOT NULL DEFAULT 'Verified Purchase',
ADD COLUMN "verifiedPurchase" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "ReviewResponse" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerRatingAggregate" (
    "id" TEXT NOT NULL,
    "vendorProfileId" TEXT NOT NULL,
    "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "weightedAverageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "recentReviews30d" INTEGER NOT NULL DEFAULT 0,
    "completionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "responseRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "onTimeDeliveryRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "flaggedReviewCount" INTEGER NOT NULL DEFAULT 0,
    "lastReviewAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SellerRatingAggregate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankingScore" (
    "id" TEXT NOT NULL,
    "vendorProfileId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewCountComponent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratingComponent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "recentReviewComponent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "completionComponent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "responseComponent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "onTimeDeliveryComponent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tierLabel" TEXT NOT NULL DEFAULT 'Rising',
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RankingScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewReminder" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "reminderType" "ReviewReminderType" NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReviewResponse_reviewId_key" ON "ReviewResponse"("reviewId");
CREATE UNIQUE INDEX "SellerRatingAggregate_vendorProfileId_key" ON "SellerRatingAggregate"("vendorProfileId");
CREATE UNIQUE INDEX "RankingScore_vendorProfileId_key" ON "RankingScore"("vendorProfileId");
CREATE UNIQUE INDEX "ReviewReminder_orderId_reminderType_key" ON "ReviewReminder"("orderId", "reminderType");

-- AddForeignKey
ALTER TABLE "ReviewResponse" ADD CONSTRAINT "ReviewResponse_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewResponse" ADD CONSTRAINT "ReviewResponse_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SellerRatingAggregate" ADD CONSTRAINT "SellerRatingAggregate_vendorProfileId_fkey" FOREIGN KEY ("vendorProfileId") REFERENCES "VendorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RankingScore" ADD CONSTRAINT "RankingScore_vendorProfileId_fkey" FOREIGN KEY ("vendorProfileId") REFERENCES "VendorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewReminder" ADD CONSTRAINT "ReviewReminder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
