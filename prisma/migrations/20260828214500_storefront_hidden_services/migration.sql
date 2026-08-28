ALTER TABLE "VendorProfile" ADD COLUMN "storefrontHiddenOfferingIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
