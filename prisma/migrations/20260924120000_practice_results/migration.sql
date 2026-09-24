-- CreateTable
CREATE TABLE "PracticeResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "bestScore" INTEGER,
    "lastScore" INTEGER,
    "runs" INTEGER NOT NULL DEFAULT 1,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PracticeResult_userId_lessonId_kind_key" ON "PracticeResult"("userId", "lessonId", "kind");
CREATE INDEX "PracticeResult_lessonId_idx" ON "PracticeResult"("lessonId");
CREATE INDEX "PracticeResult_completedAt_idx" ON "PracticeResult"("completedAt");

-- AddForeignKey
ALTER TABLE "PracticeResult" ADD CONSTRAINT "PracticeResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PracticeResult" ADD CONSTRAINT "PracticeResult_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Бейджи за практику (дублируются в prisma/seed.ts BADGES)
INSERT INTO "Badge" ("id", "code", "title", "description")
VALUES
  ('badge_first_practice', 'first-practice', 'Первая тренировка', 'Пройден первый тренажёр урока'),
  ('badge_practice_course', 'practice-course', 'Практик', 'Пройдены тренажёры во всех уроках курса')
ON CONFLICT ("code") DO NOTHING;
