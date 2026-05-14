-- Add normalized location intelligence fields for Google Places-backed discovery.
ALTER TABLE "VendorProfile"
  ADD COLUMN "formattedAddress" TEXT,
  ADD COLUMN "googlePlaceId" TEXT;

ALTER TABLE "PartyEvent"
  ADD COLUMN "formattedAddress" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "state" TEXT,
  ADD COLUMN "zipCode" TEXT,
  ADD COLUMN "locationLat" DOUBLE PRECISION,
  ADD COLUMN "locationLng" DOUBLE PRECISION,
  ADD COLUMN "googlePlaceId" TEXT;

ALTER TABLE "Listing"
  ADD COLUMN "formattedAddress" TEXT,
  ADD COLUMN "state" TEXT,
  ADD COLUMN "zipCode" TEXT,
  ADD COLUMN "locationLat" DOUBLE PRECISION,
  ADD COLUMN "locationLng" DOUBLE PRECISION,
  ADD COLUMN "googlePlaceId" TEXT;

CREATE INDEX "VendorProfile_locationLat_locationLng_idx" ON "VendorProfile"("locationLat", "locationLng");
CREATE INDEX "VendorProfile_googlePlaceId_idx" ON "VendorProfile"("googlePlaceId");
CREATE INDEX "PartyEvent_locationLat_locationLng_idx" ON "PartyEvent"("locationLat", "locationLng");
CREATE INDEX "PartyEvent_googlePlaceId_idx" ON "PartyEvent"("googlePlaceId");
CREATE INDEX "Listing_locationLat_locationLng_idx" ON "Listing"("locationLat", "locationLng");
CREATE INDEX "Listing_googlePlaceId_idx" ON "Listing"("googlePlaceId");
