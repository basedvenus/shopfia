CREATE TYPE "BusinessManagerRole" AS ENUM ('OWNER', 'MANAGER');

CREATE TYPE "VerificationDocumentType" AS ENUM ('INSURANCE', 'LICENSE', 'PERMIT');

CREATE TYPE "VerificationReviewStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED_NEEDS_REVISION', 'EXPIRED');

ALTER TABLE "VendorProfile"
ADD COLUMN "storefrontAccentColor" TEXT NOT NULL DEFAULT 'blush',
ADD COLUMN "storefrontSectionOrder" TEXT[] NOT NULL DEFAULT ARRAY['about', 'offerings', 'portfolio', 'credentials', 'reviews']::TEXT[];

CREATE TABLE "VendorProfileManager" (
  "id" TEXT NOT NULL,
  "vendorProfileId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "BusinessManagerRole" NOT NULL DEFAULT 'MANAGER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VendorProfileManager_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessVerificationDocument" (
  "id" TEXT NOT NULL,
  "vendorProfileId" TEXT NOT NULL,
  "uploadedById" TEXT NOT NULL,
  "type" "VerificationDocumentType" NOT NULL,
  "status" "VerificationReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "storageKey" TEXT NOT NULL,
  "originalName" TEXT,
  "contentType" TEXT,
  "data" BYTEA NOT NULL,
  "size" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "reviewerNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BusinessVerificationDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VendorProfileManager_vendorProfileId_userId_key" ON "VendorProfileManager"("vendorProfileId", "userId");
CREATE INDEX "VendorProfileManager_userId_idx" ON "VendorProfileManager"("userId");
CREATE INDEX "BusinessVerificationDocument_vendorProfileId_type_status_idx" ON "BusinessVerificationDocument"("vendorProfileId", "type", "status");
CREATE INDEX "BusinessVerificationDocument_uploadedById_idx" ON "BusinessVerificationDocument"("uploadedById");

ALTER TABLE "VendorProfileManager"
ADD CONSTRAINT "VendorProfileManager_vendorProfileId_fkey"
FOREIGN KEY ("vendorProfileId") REFERENCES "VendorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VendorProfileManager"
ADD CONSTRAINT "VendorProfileManager_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BusinessVerificationDocument"
ADD CONSTRAINT "BusinessVerificationDocument_vendorProfileId_fkey"
FOREIGN KEY ("vendorProfileId") REFERENCES "VendorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BusinessVerificationDocument"
ADD CONSTRAINT "BusinessVerificationDocument_uploadedById_fkey"
FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "VendorProfileManager" ("id", "vendorProfileId", "userId", "role", "createdAt", "updatedAt")
SELECT CONCAT('vpm_', replace(gen_random_uuid()::TEXT, '-', '')), "id", "userId", 'OWNER', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "VendorProfile"
WHERE "userId" IS NOT NULL
ON CONFLICT ("vendorProfileId", "userId") DO NOTHING;

ALTER TABLE "Conversation" DROP CONSTRAINT IF EXISTS "Conversation_buyerId_vendorId_key";
CREATE UNIQUE INDEX "Conversation_buyerId_vendorId_vendorProfileId_key" ON "Conversation"("buyerId", "vendorId", "vendorProfileId");
