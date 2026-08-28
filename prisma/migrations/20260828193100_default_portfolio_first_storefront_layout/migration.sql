ALTER TABLE "VendorProfile" ALTER COLUMN "storefrontLayout" SET DEFAULT 'PORTFOLIO_FIRST';

UPDATE "VendorProfile"
SET "storefrontLayout" = 'PORTFOLIO_FIRST'
WHERE "storefrontLayout" IN ('PORTFOLIO', 'SERVICES');
