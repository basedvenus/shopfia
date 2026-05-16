UPDATE "PartyCollaborator"
SET "status" = 'ACCEPTED'
WHERE "status" = 'PENDING';

ALTER TABLE "PartyCollaborator"
ALTER COLUMN "status" SET DEFAULT 'ACCEPTED';
