-- DropIndex
DROP INDEX "StaticPageSeo_path_key";

-- AlterTable
ALTER TABLE "StaticPageSeo" ADD COLUMN     "scope" TEXT NOT NULL DEFAULT 'global';

-- CreateTable
CREATE TABLE "SeoScopeOverride" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "titleTemplate" TEXT,
    "defaultTitle" TEXT,
    "defaultDescription" TEXT,
    "defaultOgKey" TEXT,
    "googleVerification" TEXT,
    "yandexVerification" TEXT,
    "ga4Id" TEXT,
    "yandexMetricaId" TEXT,
    "orgDescription" TEXT,
    "orgCountry" TEXT,
    "orgPhone" TEXT,
    "supportWhatsapp" TEXT,
    "socialTelegram" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoScopeOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SeoScopeOverride_scope_key" ON "SeoScopeOverride"("scope");

-- CreateIndex
CREATE INDEX "StaticPageSeo_path_idx" ON "StaticPageSeo"("path");

-- CreateIndex
CREATE UNIQUE INDEX "StaticPageSeo_path_scope_key" ON "StaticPageSeo"("path", "scope");

