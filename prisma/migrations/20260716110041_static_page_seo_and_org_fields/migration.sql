-- AlterTable
ALTER TABLE "SeoSettings" ADD COLUMN     "orgCountry" TEXT NOT NULL DEFAULT 'Belarus',
ADD COLUMN     "orgDescription" TEXT,
ADD COLUMN     "orgName" TEXT NOT NULL DEFAULT 'Бизнес-платформа ACTIVE SALES',
ADD COLUMN     "orgPhone" TEXT;

-- CreateTable
CREATE TABLE "StaticPageSeo" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "noindex" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaticPageSeo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaticPageSeo_path_key" ON "StaticPageSeo"("path");
