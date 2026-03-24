-- CreateEnum
CREATE TYPE "CategoryAudience" AS ENUM ('VENDOR', 'BUYER');

-- AlterTable
ALTER TABLE "Category"
ADD COLUMN "audience" "CategoryAudience" NOT NULL DEFAULT 'VENDOR';

-- CreateIndex
CREATE INDEX "Category_audience_idx" ON "Category"("audience");
