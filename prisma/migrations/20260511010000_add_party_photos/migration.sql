-- AlterTable
ALTER TABLE "PartyEvent" ADD COLUMN "location" TEXT;

-- CreateTable
CREATE TABLE "PartyPhoto" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT,
    "contentType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "size" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PartyPhotoTaggedVendors" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "PartyPhoto_eventId_sortOrder_idx" ON "PartyPhoto"("eventId", "sortOrder");

-- CreateIndex
CREATE INDEX "PartyPhoto_userId_createdAt_idx" ON "PartyPhoto"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "_PartyPhotoTaggedVendors_AB_unique" ON "_PartyPhotoTaggedVendors"("A", "B");

-- CreateIndex
CREATE INDEX "_PartyPhotoTaggedVendors_B_index" ON "_PartyPhotoTaggedVendors"("B");

-- AddForeignKey
ALTER TABLE "PartyPhoto" ADD CONSTRAINT "PartyPhoto_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyPhoto" ADD CONSTRAINT "PartyPhoto_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "PartyEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PartyPhotoTaggedVendors" ADD CONSTRAINT "_PartyPhotoTaggedVendors_A_fkey" FOREIGN KEY ("A") REFERENCES "PartyPhoto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PartyPhotoTaggedVendors" ADD CONSTRAINT "_PartyPhotoTaggedVendors_B_fkey" FOREIGN KEY ("B") REFERENCES "VendorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
