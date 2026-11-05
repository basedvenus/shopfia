ALTER TABLE "User" ADD COLUMN "preferredLanguage" VARCHAR(2) NOT NULL DEFAULT 'en';
ALTER TABLE "User" ADD CONSTRAINT "User_preferredLanguage_check" CHECK ("preferredLanguage" IN ('en', 'es'));
