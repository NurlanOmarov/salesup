-- Журнал 404 (агрегат по пути) для менеджера редиректов + alt-текст обложки курса (AI).

ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "coverAlt" TEXT;

CREATE TABLE IF NOT EXISTS "NotFoundHit" (
  "id" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "hits" INTEGER NOT NULL DEFAULT 1,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotFoundHit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "NotFoundHit_path_key" ON "NotFoundHit"("path");
CREATE INDEX IF NOT EXISTS "NotFoundHit_lastSeenAt_idx" ON "NotFoundHit"("lastSeenAt");
