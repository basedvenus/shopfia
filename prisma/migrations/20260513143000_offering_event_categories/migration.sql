CREATE TABLE "OfferingEventCategory" (
    "id" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfferingEventCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OfferingEventCategory_offeringId_categoryId_key"
ON "OfferingEventCategory"("offeringId", "categoryId");

ALTER TABLE "OfferingEventCategory"
ADD CONSTRAINT "OfferingEventCategory_offeringId_fkey"
FOREIGN KEY ("offeringId") REFERENCES "Offering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OfferingEventCategory"
ADD CONSTRAINT "OfferingEventCategory_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "Category" ("id", "name", "iconName", "audience", "createdAt", "updatedAt")
SELECT 'cmgraduationparty000000000000000', 'Graduation Party', 'graduation-cap', 'BUYER', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM "Category" WHERE "name" = 'Graduation Party'
);
