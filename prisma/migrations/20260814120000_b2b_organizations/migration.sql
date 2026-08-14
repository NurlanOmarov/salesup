-- B2B: организации, лицензии, места (docs/B2B-PLAN.md, оферта /offer-b2b).
-- Доступ к контенту по-прежнему определяется только Enrollment (CLAUDE.md правило 1):
-- лицензия — слой выдачи, порождающий обычные Enrollment с source = 'B2B'.

-- CreateEnum
CREATE TYPE "OrgStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('ORG_ADMIN', 'ORG_LEARNER');

-- AlterEnum: место из корпоративной лицензии
ALTER TYPE "EnrollmentSource" ADD VALUE IF NOT EXISTS 'B2B';

-- AlterTable: учётка работника создаётся без e-mail (ПДн не собираем), вход по login
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "login" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_login_key" ON "User"("login");

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unp" TEXT,
    "contactEmail" TEXT,
    "contactNote" TEXT,
    "note" TEXT,
    "status" "OrgStatus" NOT NULL DEFAULT 'ACTIVE',
    "loginSeq" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
CREATE INDEX "Organization_status_idx" ON "Organization"("status");

-- CreateTable
CREATE TABLE "OrgGroup" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "OrgGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrgGroup_orgId_name_key" ON "OrgGroup"("orgId", "name");

-- CreateTable
CREATE TABLE "OrgMembership" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'ORG_LEARNER',
    "groupId" TEXT,
    "labelEnc" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivatedAt" TIMESTAMP(3),

    CONSTRAINT "OrgMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrgMembership_orgId_userId_key" ON "OrgMembership"("orgId", "userId");
CREATE INDEX "OrgMembership_orgId_isActive_idx" ON "OrgMembership"("orgId", "isActive");

-- CreateTable
CREATE TABLE "OrgKeyWrap" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT,
    "kind" TEXT NOT NULL,
    "wrappedKey" TEXT NOT NULL,
    "kdfSalt" TEXT NOT NULL,
    "kdfParams" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgKeyWrap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrgKeyWrap_orgId_userId_kind_key" ON "OrgKeyWrap"("orgId", "userId", "kind");
CREATE INDEX "OrgKeyWrap_orgId_idx" ON "OrgKeyWrap"("orgId");

-- CreateTable
CREATE TABLE "OrgLicense" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "seatsTotal" INTEGER NOT NULL,
    "accessDuration" "AccessDuration" NOT NULL DEFAULT 'MONTHS_12',
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "priceTiyn" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgLicense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrgLicense_orgId_courseId_key" ON "OrgLicense"("orgId", "courseId");
CREATE INDEX "OrgLicense_orgId_idx" ON "OrgLicense"("orgId");

-- CreateTable
CREATE TABLE "OrgInvite" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "groupId" TEXT,
    "licenseIds" JSONB NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "OrgInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrgInvite_code_key" ON "OrgInvite"("code");
CREATE INDEX "OrgInvite_orgId_revokedAt_idx" ON "OrgInvite"("orgId", "revokedAt");

-- AlterTable: место, выданное из лицензии
ALTER TABLE "Enrollment" ADD COLUMN IF NOT EXISTS "licenseId" TEXT;
ALTER TABLE "Enrollment" ADD COLUMN IF NOT EXISTS "revokedReason" TEXT;
CREATE INDEX IF NOT EXISTS "Enrollment_licenseId_idx" ON "Enrollment"("licenseId");

-- AddForeignKey
ALTER TABLE "OrgGroup" ADD CONSTRAINT "OrgGroup_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrgMembership" ADD CONSTRAINT "OrgMembership_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrgMembership" ADD CONSTRAINT "OrgMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrgMembership" ADD CONSTRAINT "OrgMembership_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "OrgGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrgKeyWrap" ADD CONSTRAINT "OrgKeyWrap_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrgKeyWrap" ADD CONSTRAINT "OrgKeyWrap_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrgLicense" ADD CONSTRAINT "OrgLicense_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrgLicense" ADD CONSTRAINT "OrgLicense_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrgInvite" ADD CONSTRAINT "OrgInvite_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "OrgLicense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
