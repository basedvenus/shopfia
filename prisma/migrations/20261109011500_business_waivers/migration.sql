CREATE TABLE "BusinessWaiver" ("id" TEXT NOT NULL PRIMARY KEY,"vendorId" TEXT NOT NULL,"title" TEXT NOT NULL,"fileName" TEXT NOT NULL,"data" BYTEA NOT NULL,"sha256" TEXT NOT NULL,"uploadedById" TEXT NOT NULL,"archived" BOOLEAN NOT NULL DEFAULT false,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE "WaiverAssignment" ("id" TEXT NOT NULL PRIMARY KEY,"waiverId" TEXT NOT NULL REFERENCES "BusinessWaiver"("id") ON DELETE RESTRICT ON UPDATE CASCADE,"offeringId" TEXT NOT NULL,"packageId" TEXT NOT NULL DEFAULT '');
CREATE TABLE "WaiverSignature" ("id" TEXT NOT NULL PRIMARY KEY,"waiverId" TEXT NOT NULL REFERENCES "BusinessWaiver"("id") ON DELETE RESTRICT ON UPDATE CASCADE,"quoteId" TEXT NOT NULL,"buyerId" TEXT NOT NULL,"signerName" TEXT NOT NULL,"consentText" TEXT NOT NULL,"documentHash" TEXT NOT NULL,"quoteHash" TEXT NOT NULL,"signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"userAgent" TEXT NOT NULL);
CREATE INDEX "BusinessWaiver_vendorId_archived_idx" ON "BusinessWaiver"("vendorId","archived");
CREATE UNIQUE INDEX "WaiverAssignment_waiverId_offeringId_packageId_key" ON "WaiverAssignment"("waiverId","offeringId","packageId");
CREATE INDEX "WaiverAssignment_offeringId_idx" ON "WaiverAssignment"("offeringId");
CREATE UNIQUE INDEX "WaiverSignature_waiverId_quoteId_buyerId_quoteHash_key" ON "WaiverSignature"("waiverId","quoteId","buyerId","quoteHash");
CREATE INDEX "WaiverSignature_quoteId_buyerId_idx" ON "WaiverSignature"("quoteId","buyerId");
