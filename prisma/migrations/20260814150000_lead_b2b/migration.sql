-- Тип заявки: розница или организация (docs/PRICING-PLAN.md §8, B2B-PLAN §8).
-- Без этого корпоративные заявки неотличимы от розничных в /admin/leads —
-- приходится угадывать по тексту сообщения.

-- CreateEnum
CREATE TYPE "LeadKind" AS ENUM ('B2C', 'B2B');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "kind" "LeadKind" NOT NULL DEFAULT 'B2C';
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "seatsWanted" INTEGER;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "company" TEXT;
