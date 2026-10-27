-- CreateTable
CREATE TABLE "PartyVendorRating" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyVendorRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartyVendorRating_vendorId_createdAt_idx" ON "PartyVendorRating"("vendorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PartyVendorRating_eventId_userId_vendorId_key" ON "PartyVendorRating"("eventId", "userId", "vendorId");

-- AddForeignKey
ALTER TABLE "PartyVendorRating" ADD CONSTRAINT "PartyVendorRating_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "PartyEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyVendorRating" ADD CONSTRAINT "PartyVendorRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyVendorRating" ADD CONSTRAINT "PartyVendorRating_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "VendorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "PartyVendorRating" ADD CONSTRAINT "PartyVendorRating_rating_check" CHECK (rating BETWEEN 1 AND 5);
INSERT INTO "PartyVendorRating" (id,"eventId","userId","vendorId",rating,"createdAt","updatedAt")
SELECT DISTINCT ON (p."eventId",r."userId",r."vendorId") 'party-rating-' || md5(p."eventId" || r."userId" || r."vendorId"),p."eventId",r."userId",r."vendorId",r.rating,r."createdAt",r."updatedAt"
FROM "PartyPhotoVendorRating" r JOIN "PartyPhoto" p ON p.id=r."photoId"
WHERE p."eventId" IS NOT NULL AND r.rating BETWEEN 1 AND 5
ORDER BY p."eventId",r."userId",r."vendorId",r."updatedAt" DESC,r.id DESC
ON CONFLICT ("eventId","userId","vendorId") DO NOTHING;
