-- CreateEnum
CREATE TYPE "PodcastState" AS ENUM ('GENERATING', 'AUDIO_READY', 'WAITING', 'SHIPPING', 'FAILED');

-- CreateEnum
CREATE TYPE "PodcastRunOutcome" AS ENUM ('RUNNING', 'QUOTA', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "PodcastLessonStatus" (
    "lessonId" TEXT NOT NULL,
    "state" "PodcastState" NOT NULL,
    "message" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PodcastLessonStatus_pkey" PRIMARY KEY ("lessonId")
);

-- CreateTable
CREATE TABLE "PodcastRun" (
    "id" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "outcome" "PodcastRunOutcome" NOT NULL DEFAULT 'RUNNING',
    "generated" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,

    CONSTRAINT "PodcastRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PodcastRun_startedAt_idx" ON "PodcastRun"("startedAt");

-- AddForeignKey
ALTER TABLE "PodcastLessonStatus" ADD CONSTRAINT "PodcastLessonStatus_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

