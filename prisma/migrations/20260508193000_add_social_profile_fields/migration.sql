ALTER TABLE "User" ADD COLUMN "username" TEXT;
ALTER TABLE "User" ADD COLUMN "bio" TEXT;
ALTER TABLE "User" ADD COLUMN "instagramUrl" TEXT;
ALTER TABLE "User" ADD COLUMN "tiktokUrl" TEXT;
ALTER TABLE "User" ADD COLUMN "partyfulUrl" TEXT;
ALTER TABLE "User" ADD COLUMN "partyPhotoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
