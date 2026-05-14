-- CreateTable
CREATE TABLE "PartyPhotoVendorRating" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyPhotoVendorRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartyPhotoVendorRating_photoId_vendorId_key" ON "PartyPhotoVendorRating"("photoId", "vendorId");

-- CreateIndex
CREATE INDEX "PartyPhotoVendorRating_userId_createdAt_idx" ON "PartyPhotoVendorRating"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PartyPhotoVendorRating_vendorId_createdAt_idx" ON "PartyPhotoVendorRating"("vendorId", "createdAt");

-- AddForeignKey
ALTER TABLE "PartyPhotoVendorRating" ADD CONSTRAINT "PartyPhotoVendorRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyPhotoVendorRating" ADD CONSTRAINT "PartyPhotoVendorRating_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "PartyPhoto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyPhotoVendorRating" ADD CONSTRAINT "PartyPhotoVendorRating_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "VendorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
