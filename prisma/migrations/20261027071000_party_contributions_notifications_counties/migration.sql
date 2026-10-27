-- CreateEnum
CREATE TYPE "PartyContributionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PartyContributionKind" AS ENUM ('PHOTO', 'TIKTOK', 'PLAYLIST');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "partyEmailNotifications" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PartyEvent" ADD COLUMN     "county" TEXT,
ADD COLUMN     "countyFips" TEXT,
ADD COLUMN     "pinterestUrl" TEXT,
ADD COLUMN     "spotifyUrl" TEXT,
ADD COLUMN     "tiktokUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "PartyContribution" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "PartyContributionKind" NOT NULL,
    "status" "PartyContributionStatus" NOT NULL DEFAULT 'PENDING',
    "photoId" TEXT,
    "tiktokUrl" TEXT,
    "appleMusicUrl" TEXT,
    "spotifyUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "PartyContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "emailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartyContribution_photoId_key" ON "PartyContribution"("photoId");

-- CreateIndex
CREATE INDEX "PartyContribution_eventId_status_createdAt_idx" ON "PartyContribution"("eventId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PartyContribution_userId_createdAt_idx" ON "PartyContribution"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_eventId_emailSentAt_idx" ON "Notification"("eventId", "emailSentAt");

-- AddForeignKey
ALTER TABLE "PartyContribution" ADD CONSTRAINT "PartyContribution_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "PartyEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyContribution" ADD CONSTRAINT "PartyContribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyContribution" ADD CONSTRAINT "PartyContribution_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "PartyPhoto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "PartyEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve existing videos when editing parties with the new multi-video field.
UPDATE "PartyEvent" SET "tiktokUrls" = ARRAY["tiktokUrl"] WHERE "tiktokUrl" IS NOT NULL;

-- Make pre-existing pending invitations visible in the new notification inbox.
INSERT INTO "Notification" ("id", "userId", "eventId", "kind", "title", "href", "dedupeKey")
SELECT 'invite-' || md5(c."eventId" || ':' || c."userId"), c."userId", c."eventId", 'PARTY_INVITATION',
       'You were invited to ' || e."title" || CASE WHEN c."role" = 'GUEST' THEN ' as a guest' ELSE ' as a host' END,
       '/my-parties#party-invitations', 'party-invite:' || c."eventId" || ':' || c."userId"
FROM "PartyCollaborator" c JOIN "PartyEvent" e ON e."id" = c."eventId"
WHERE c."status" = 'PENDING'
ON CONFLICT ("dedupeKey") DO NOTHING;
