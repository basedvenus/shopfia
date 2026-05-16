-- CreateEnum
CREATE TYPE "PartyCollaboratorRole" AS ENUM ('MAIN_HOST', 'CO_HOST');

-- CreateEnum
CREATE TYPE "PartyCollaborationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'REMOVED');

-- CreateTable
CREATE TABLE "PartyCollaborator" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "PartyCollaboratorRole" NOT NULL,
    "status" "PartyCollaborationStatus" NOT NULL DEFAULT 'PENDING',
    "invitedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyCollaborator_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartyCollaborator_eventId_userId_key" ON "PartyCollaborator"("eventId", "userId");

-- CreateIndex
CREATE INDEX "PartyCollaborator_userId_status_idx" ON "PartyCollaborator"("userId", "status");

-- CreateIndex
CREATE INDEX "PartyCollaborator_eventId_status_idx" ON "PartyCollaborator"("eventId", "status");

-- AddForeignKey
ALTER TABLE "PartyCollaborator" ADD CONSTRAINT "PartyCollaborator_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "PartyEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyCollaborator" ADD CONSTRAINT "PartyCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
