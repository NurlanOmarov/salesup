-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "site" TEXT;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "site" TEXT;

-- CreateIndex
CREATE INDEX "Enrollment_site_startsAt_idx" ON "Enrollment"("site", "startsAt");

-- CreateIndex
CREATE INDEX "Lead_site_createdAt_idx" ON "Lead"("site", "createdAt");
