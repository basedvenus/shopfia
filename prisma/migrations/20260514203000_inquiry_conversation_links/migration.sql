ALTER TABLE "Inquiry"
  ADD COLUMN "buyerId" TEXT,
  ADD COLUMN "conversationId" TEXT,
  ADD COLUMN "formattedAddress" TEXT,
  ADD COLUMN "locationCity" TEXT,
  ADD COLUMN "locationState" TEXT,
  ADD COLUMN "locationZipCode" TEXT,
  ADD COLUMN "locationLat" DOUBLE PRECISION,
  ADD COLUMN "locationLng" DOUBLE PRECISION,
  ADD COLUMN "googlePlaceId" TEXT,
  ADD COLUMN "guestCount" INTEGER,
  ADD COLUMN "inspirationUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Inquiry" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "Inquiry" ALTER COLUMN "eventLocation" DROP NOT NULL;

ALTER TABLE "Conversation"
  ADD COLUMN "listingId" TEXT,
  ADD COLUMN "offeringId" TEXT;

ALTER TABLE "Message"
  ADD COLUMN "readAt" TIMESTAMP(3);

CREATE INDEX "Inquiry_buyerId_idx" ON "Inquiry"("buyerId");
CREATE INDEX "Inquiry_conversationId_idx" ON "Inquiry"("conversationId");
CREATE INDEX "Inquiry_locationLat_locationLng_idx" ON "Inquiry"("locationLat", "locationLng");
CREATE INDEX "Conversation_listingId_idx" ON "Conversation"("listingId");
CREATE INDEX "Conversation_offeringId_idx" ON "Conversation"("offeringId");
CREATE INDEX "Message_conversationId_readAt_idx" ON "Message"("conversationId", "readAt");

ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "Offering"("id") ON DELETE SET NULL ON UPDATE CASCADE;
