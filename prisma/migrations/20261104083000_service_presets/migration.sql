CREATE TABLE "ServicePreset" (
 "id" TEXT NOT NULL,
 "businessId" TEXT NOT NULL,
 "kind" TEXT NOT NULL,
 "name" TEXT NOT NULL,
 "payload" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ServicePreset_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ServicePreset_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "VendorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ServicePreset_businessId_createdAt_idx" ON "ServicePreset"("businessId", "createdAt");
CREATE UNIQUE INDEX "ServicePreset_businessId_kind_name_key" ON "ServicePreset"("businessId", "kind", "name");
