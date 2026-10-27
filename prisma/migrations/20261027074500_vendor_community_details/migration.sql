-- CreateTable
CREATE TABLE "VendorCommunitySubmission" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookingChannel" TEXT NOT NULL,
    "bookingDetails" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorCommunitySubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VendorCommunitySubmission_vendorId_idx" ON "VendorCommunitySubmission"("vendorId");

-- CreateIndex
CREATE INDEX "VendorCommunitySubmission_userId_idx" ON "VendorCommunitySubmission"("userId");

-- AddForeignKey
ALTER TABLE "VendorCommunitySubmission" ADD CONSTRAINT "VendorCommunitySubmission_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "VendorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorCommunitySubmission" ADD CONSTRAINT "VendorCommunitySubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

