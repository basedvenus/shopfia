ALTER TABLE "PartyEvent" ADD COLUMN "slug" TEXT;
ALTER TABLE "PartyEvent" ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

UPDATE "PartyEvent"
SET "slug" = CONCAT(
  regexp_replace(lower("title"), '[^a-z0-9]+', '-', 'g'),
  '-',
  substring("id" from 1 for 6)
)
WHERE "slug" IS NULL;

ALTER TABLE "PartyEvent" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "PartyEvent_slug_key" ON "PartyEvent"("slug");

CREATE TABLE "Follow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Follow_followerId_followingId_key" ON "Follow"("followerId", "followingId");

ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "_PartyEventTaggedVendors" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

CREATE UNIQUE INDEX "_PartyEventTaggedVendors_AB_unique" ON "_PartyEventTaggedVendors"("A", "B");
CREATE INDEX "_PartyEventTaggedVendors_B_index" ON "_PartyEventTaggedVendors"("B");

ALTER TABLE "_PartyEventTaggedVendors" ADD CONSTRAINT "_PartyEventTaggedVendors_A_fkey" FOREIGN KEY ("A") REFERENCES "PartyEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_PartyEventTaggedVendors" ADD CONSTRAINT "_PartyEventTaggedVendors_B_fkey" FOREIGN KEY ("B") REFERENCES "VendorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
