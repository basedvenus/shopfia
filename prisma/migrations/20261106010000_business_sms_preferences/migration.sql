ALTER TABLE "PhoneVerificationProfile"
  ADD COLUMN "businessSmsEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "businessSmsConsentAt" TIMESTAMP(3);

CREATE TABLE "BusinessSmsDelivery" (
  "eventKey" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "providerSid" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BusinessSmsDelivery_pkey" PRIMARY KEY ("eventKey", "userId"),
  CONSTRAINT "BusinessSmsDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
