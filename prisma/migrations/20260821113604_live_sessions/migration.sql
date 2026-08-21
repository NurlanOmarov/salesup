-- CreateEnum
CREATE TYPE "LiveSessionKind" AS ENUM ('INTRO', 'FINAL', 'EXTRA');

-- CreateEnum
CREATE TYPE "LiveSessionStatus" AS ENUM ('PLANNED', 'LIVE', 'FINISHED', 'CANCELLED');

-- CreateTable
CREATE TABLE "LiveSession" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "courseId" TEXT,
    "kind" "LiveSessionKind" NOT NULL,
    "title" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Minsk',
    "durationMin" INTEGER NOT NULL DEFAULT 60,
    "status" "LiveSessionStatus" NOT NULL DEFAULT 'PLANNED',
    "sabakLessonId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "joinUrl" TEXT,
    "recordingId" TEXT,
    "recordingReady" BOOLEAN NOT NULL DEFAULT false,
    "attendedCount" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveSessionAttendance" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "memberLogin" TEXT NOT NULL,
    "attended" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LiveSessionAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LiveSession_sabakLessonId_key" ON "LiveSession"("sabakLessonId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveSession_idempotencyKey_key" ON "LiveSession"("idempotencyKey");

-- CreateIndex
CREATE INDEX "LiveSession_orgId_scheduledAt_idx" ON "LiveSession"("orgId", "scheduledAt");

-- CreateIndex
CREATE INDEX "LiveSession_status_scheduledAt_idx" ON "LiveSession"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "LiveSessionAttendance_sessionId_idx" ON "LiveSessionAttendance"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveSessionAttendance_sessionId_memberLogin_key" ON "LiveSessionAttendance"("sessionId", "memberLogin");

-- AddForeignKey
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSessionAttendance" ADD CONSTRAINT "LiveSessionAttendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
