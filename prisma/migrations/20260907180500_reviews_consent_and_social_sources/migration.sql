-- Отзывы: согласие на публикацию и источники из соцсетей школы.

-- AlterEnum: отзывы переносятся не только с карт, но и из соцсетей (со ссылкой).
ALTER TYPE "ReviewSource" ADD VALUE 'INSTAGRAM';
ALTER TYPE "ReviewSource" ADD VALUE 'FACEBOOK';
ALTER TYPE "ReviewSource" ADD VALUE 'VK';
ALTER TYPE "ReviewSource" ADD VALUE 'YOUTUBE';
ALTER TYPE "ReviewSource" ADD VALUE 'TELEGRAM';

-- AlterTable: согласие ученика на публикацию отзыва под своим именем (99-З).
ALTER TABLE "Review" ADD COLUMN "publicConsent" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex: один отзыв ученика на курс (отзывы владельца с userId IS NULL
-- под ограничение не попадают — в PostgreSQL NULL не конфликтует).
CREATE UNIQUE INDEX "Review_courseId_userId_key" ON "Review"("courseId", "userId");
