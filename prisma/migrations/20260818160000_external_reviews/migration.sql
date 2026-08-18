-- CreateEnum
CREATE TYPE "ReviewSource" AS ENUM ('YANDEX', 'GOOGLE', 'OTHER');

-- CreateTable
CREATE TABLE "ExternalReview" (
    "id" TEXT NOT NULL,
    "source" "ReviewSource" NOT NULL,
    "author" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "url" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalReview_published_sortOrder_idx" ON "ExternalReview"("published", "sortOrder");

