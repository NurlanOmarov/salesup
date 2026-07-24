-- CreateEnum
CREATE TYPE "CourseAudience" AS ENUM ('EVERYONE', 'SPECIALIZED');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "audience" "CourseAudience" NOT NULL DEFAULT 'SPECIALIZED';
