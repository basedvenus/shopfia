ALTER TABLE "VendorProfile"
ADD COLUMN "stripeChargesEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "stripePayoutsEnabled" BOOLEAN NOT NULL DEFAULT false;
