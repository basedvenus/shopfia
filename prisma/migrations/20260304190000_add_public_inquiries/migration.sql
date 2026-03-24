CREATE TYPE "InquiryStatus" AS ENUM ('NEW', 'REVIEWED', 'CLOSED');

CREATE TABLE "Inquiry" (
    "id" TEXT NOT NULL,
    "vendorProfileId" TEXT NOT NULL,
    "listingId" TEXT,
    "offeringId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "eventDate" TIMESTAMP(3),
    "eventLocation" TEXT NOT NULL,
    "budgetCents" INTEGER,
    "message" TEXT,
    "status" "InquiryStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inquiry_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_vendorProfileId_fkey" FOREIGN KEY ("vendorProfileId") REFERENCES "VendorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "Offering"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Inquiry_vendorProfileId_createdAt_idx" ON "Inquiry"("vendorProfileId", "createdAt");
CREATE INDEX "Inquiry_listingId_idx" ON "Inquiry"("listingId");
