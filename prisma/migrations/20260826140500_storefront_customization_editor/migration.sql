CREATE TYPE "StorefrontLayout" AS ENUM ('EDITORIAL', 'PORTFOLIO', 'SERVICES');

CREATE TYPE "StorefrontFontStyle" AS ENUM ('MODERN', 'EDITORIAL', 'ROMANTIC', 'PLAYFUL');

CREATE TYPE "StorefrontPalette" AS ENUM ('BLUSH', 'WARM_NEUTRAL', 'SAGE', 'LAVENDER', 'CHAMPAGNE', 'MIDNIGHT');

CREATE TYPE "StorefrontButtonStyle" AS ENUM ('PILL', 'SOFT', 'OUTLINE');

CREATE TYPE "StorefrontImageShape" AS ENUM ('ROUNDED', 'SOFT', 'SQUARE');

ALTER TABLE "VendorProfile"
ALTER COLUMN "storefrontSectionOrder" SET DEFAULT ARRAY['hero', 'about', 'portfolio', 'services', 'featured-parties', 'reviews', 'service-area', 'inquiry-form', 'social-links']::TEXT[],
ADD COLUMN "storefrontHiddenSections" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "storefrontTagline" TEXT,
ADD COLUMN "storefrontAboutHeading" TEXT,
ADD COLUMN "storefrontAboutImage" TEXT,
ADD COLUMN "storefrontLayout" "StorefrontLayout" NOT NULL DEFAULT 'EDITORIAL',
ADD COLUMN "storefrontFontStyle" "StorefrontFontStyle" NOT NULL DEFAULT 'MODERN',
ADD COLUMN "storefrontPalette" "StorefrontPalette" NOT NULL DEFAULT 'BLUSH',
ADD COLUMN "storefrontButtonStyle" "StorefrontButtonStyle" NOT NULL DEFAULT 'PILL',
ADD COLUMN "storefrontImageShape" "StorefrontImageShape" NOT NULL DEFAULT 'ROUNDED';
