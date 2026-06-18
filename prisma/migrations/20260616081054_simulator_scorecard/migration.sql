-- CreateEnum
CREATE TYPE "PersonaArchetype" AS ENUM ('BUSY_DOCTOR', 'SKEPTIC', 'PROCUREMENT', 'FRIENDLY_NONCOMMITTAL', 'AGGRESSIVE');

-- AlterTable
ALTER TABLE "SimulationRun" ADD COLUMN     "complianceFlags" JSONB,
ADD COLUMN     "passed" BOOLEAN,
ADD COLUMN     "scorecard" JSONB;

-- AlterTable
ALTER TABLE "SimulationScenario" ADD COLUMN     "archetype" "PersonaArchetype" NOT NULL DEFAULT 'BUSY_DOCTOR',
ADD COLUMN     "complianceRules" JSONB,
ADD COLUMN     "difficulty" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "rubric" JSONB;
