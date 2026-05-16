ALTER TYPE "OfferingType" ADD VALUE IF NOT EXISTS 'RENTAL';

CREATE TABLE IF NOT EXISTS "OfferingCategory" (
  "offeringId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OfferingCategory_pkey" PRIMARY KEY ("offeringId", "categoryId")
);

CREATE INDEX IF NOT EXISTS "OfferingCategory_categoryId_idx" ON "OfferingCategory"("categoryId");

ALTER TABLE "OfferingCategory"
ADD CONSTRAINT "OfferingCategory_offeringId_fkey"
FOREIGN KEY ("offeringId") REFERENCES "Offering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OfferingCategory"
ADD CONSTRAINT "OfferingCategory_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "OfferingCategory" ("offeringId", "categoryId")
SELECT "id", "categoryId"
FROM "Offering"
ON CONFLICT DO NOTHING;
