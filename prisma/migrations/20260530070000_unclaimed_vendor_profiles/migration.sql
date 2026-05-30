CREATE TYPE "VendorProfileStatus" AS ENUM ('CLAIMED', 'UNCLAIMED');

ALTER TABLE "VendorProfile"
ADD COLUMN "status" "VendorProfileStatus" NOT NULL DEFAULT 'CLAIMED',
ADD COLUMN "claimedAt" TIMESTAMP(3);

ALTER TABLE "VendorProfile"
ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "VendorProfile"
DROP CONSTRAINT "VendorProfile_userId_fkey";

ALTER TABLE "VendorProfile"
ADD CONSTRAINT "VendorProfile_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
