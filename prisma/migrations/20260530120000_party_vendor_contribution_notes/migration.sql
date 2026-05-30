ALTER TABLE "PartyPhotoVendorRating"
  ADD COLUMN "contributionNote" TEXT;

ALTER TABLE "PartyPhotoVendorRating"
  ALTER COLUMN "rating" DROP NOT NULL;
