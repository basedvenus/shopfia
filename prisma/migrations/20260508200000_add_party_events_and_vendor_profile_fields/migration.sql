ALTER TABLE "VendorProfile" ADD COLUMN "username" TEXT;
ALTER TABLE "VendorProfile" ADD COLUMN "website" TEXT;
ALTER TABLE "VendorProfile" ADD COLUMN "logoUrl" TEXT;

CREATE UNIQUE INDEX "VendorProfile_username_key" ON "VendorProfile"("username");

CREATE TABLE "PartyEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "theme" TEXT,
    "description" TEXT,
    "coverImageUrl" TEXT,
    "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PartyEvent" ADD CONSTRAINT "PartyEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
