ALTER TABLE "Favorite" ALTER COLUMN "vendorId" DROP NOT NULL;
ALTER TABLE "Favorite" ADD COLUMN "partyEventId" TEXT;
ALTER TABLE "Favorite" ADD COLUMN "offeringId" TEXT;
ALTER TABLE "Favorite" ADD COLUMN "collectionId" TEXT;

CREATE TABLE "FavoriteCollection" (
  "id" TEXT NOT NULL,
  "buyerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FavoriteCollection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Favorite_buyerId_partyEventId_key" ON "Favorite"("buyerId", "partyEventId");
CREATE UNIQUE INDEX "Favorite_buyerId_offeringId_key" ON "Favorite"("buyerId", "offeringId");
CREATE INDEX "Favorite_buyerId_createdAt_idx" ON "Favorite"("buyerId", "createdAt");
CREATE INDEX "Favorite_collectionId_idx" ON "Favorite"("collectionId");
CREATE UNIQUE INDEX "FavoriteCollection_buyerId_name_key" ON "FavoriteCollection"("buyerId", "name");
CREATE INDEX "FavoriteCollection_buyerId_createdAt_idx" ON "FavoriteCollection"("buyerId", "createdAt");

ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_partyEventId_fkey" FOREIGN KEY ("partyEventId") REFERENCES "PartyEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "Offering"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "FavoriteCollection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FavoriteCollection" ADD CONSTRAINT "FavoriteCollection_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
