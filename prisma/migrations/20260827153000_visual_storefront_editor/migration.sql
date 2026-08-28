ALTER TABLE "VendorProfile"
ADD COLUMN "storefrontDraftJson" JSONB,
ADD COLUMN "storefrontFaqJson" JSONB,
ADD COLUMN "storefrontPoliciesJson" JSONB,
ADD COLUMN "storefrontBookingJson" JSONB,
ADD COLUMN "storefrontFeaturedOfferingIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "storefrontOfferingOrder" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
