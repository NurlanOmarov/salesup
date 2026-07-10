-- AlterTable
ALTER TABLE "User" ADD COLUMN     "onboardedAt" TIMESTAMP(3),
ADD COLUMN     "weeklyGoal" INTEGER NOT NULL DEFAULT 3;
