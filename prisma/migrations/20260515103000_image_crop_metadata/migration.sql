-- Add image crop metadata without altering original uploaded assets.
ALTER TABLE "User" ADD COLUMN "imageCrop" JSONB;

ALTER TABLE "VendorProfile" ADD COLUMN "photoCrops" JSONB;
ALTER TABLE "VendorProfile" ADD COLUMN "coverPhotoCrop" JSONB;
ALTER TABLE "VendorProfile" ADD COLUMN "logoCrop" JSONB;

ALTER TABLE "PartyEvent" ADD COLUMN "coverImageCrop" JSONB;
ALTER TABLE "PartyEvent" ADD COLUMN "imageCrops" JSONB;

ALTER TABLE "PartyPhoto" ADD COLUMN "crop" JSONB;

ALTER TABLE "Offering" ADD COLUMN "photoCrops" JSONB;
