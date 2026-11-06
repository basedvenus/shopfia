CREATE TABLE "PhoneVerificationProfile" (
  "userId" TEXT NOT NULL,
  "phone" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "pendingPhone" TEXT,
  "pendingSid" TEXT,
  "pendingExpiresAt" TIMESTAMP(3),
  "lastSentAt" TIMESTAMP(3),
  "sendWindowStart" TIMESTAMP(3),
  "sendCount" INTEGER NOT NULL DEFAULT 0,
  "checkCount" INTEGER NOT NULL DEFAULT 0,
  "requestId" TEXT,
  CONSTRAINT "PhoneVerificationProfile_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "PhoneVerificationProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
