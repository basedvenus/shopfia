CREATE TABLE "PartyComment" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "parentId" TEXT,
  "body" VARCHAR(1000) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartyComment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PartyComment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "PartyEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PartyComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PartyComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "PartyComment"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "PartyComment_eventId_createdAt_idx" ON "PartyComment"("eventId", "createdAt");
CREATE INDEX "PartyComment_parentId_idx" ON "PartyComment"("parentId");
