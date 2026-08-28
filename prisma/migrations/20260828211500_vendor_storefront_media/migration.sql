CREATE TABLE "VendorStorefrontMedia" (
    "id" TEXT NOT NULL,
    "vendorProfileId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorStorefrontMedia_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VendorStorefrontMedia_vendorProfileId_idx" ON "VendorStorefrontMedia"("vendorProfileId");
CREATE INDEX "VendorStorefrontMedia_uploadedById_idx" ON "VendorStorefrontMedia"("uploadedById");

ALTER TABLE "VendorStorefrontMedia" ADD CONSTRAINT "VendorStorefrontMedia_vendorProfileId_fkey" FOREIGN KEY ("vendorProfileId") REFERENCES "VendorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VendorStorefrontMedia" ADD CONSTRAINT "VendorStorefrontMedia_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
