-- Выбранный тариф в заявке: курс, подписка на библиотеку или набор курсов,
-- плюс цена, которую человек видел на экране (считает сервер по lib/pricing).
-- Без этого корпоративная заявка приходит как «нас 12» — непонятно, смотрели ли
-- библиотеку или пару курсов, и какую сумму собеседник уже держит в голове.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "LeadPlan" AS ENUM ('COURSE', 'LIBRARY', 'COURSES');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "plan" "LeadPlan";
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "quotedPerSeatTiyn" INTEGER;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "quotedTotalTiyn" INTEGER;
