-- Ручные SEO-настройки в админке: глобальный singleton + per-course override-поля.
-- См. docs/SEO-ADMIN-PLAN.md. Счётчики GA4/Метрики — только на публичных страницах (D-002).

-- Per-course override-поля (пусто → берётся сгенерённое фабрикой / дефолт).
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "ogTitle" TEXT;
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "ogDescription" TEXT;
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "canonicalPath" TEXT;
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "focusKeyword" TEXT;
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "seoNoindex" BOOLEAN NOT NULL DEFAULT false;

-- Глобальные SEO-настройки (singleton).
CREATE TABLE IF NOT EXISTS "SeoSettings" (
  "id" TEXT NOT NULL DEFAULT 'singleton',
  "titleTemplate" TEXT NOT NULL DEFAULT '%s · ACTIVE SALES',
  "defaultTitle" TEXT NOT NULL DEFAULT 'Бизнес-платформа ACTIVE SALES — курсы по продажам с AI-наставником',
  "defaultDescription" TEXT NOT NULL DEFAULT 'Онлайн-курсы по техникам продаж: видеоуроки, AI-тренажёр на материале тренера, тесты и сертификаты.',
  "socialInstagram" TEXT,
  "socialTelegram" TEXT,
  "socialYoutube" TEXT,
  "socialTiktok" TEXT,
  "defaultOgKey" TEXT,
  "googleVerification" TEXT,
  "yandexVerification" TEXT,
  "ga4Id" TEXT,
  "yandexMetricaId" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SeoSettings_pkey" PRIMARY KEY ("id")
);

-- 301/308-редиректы (смена slug курса и т.п.). Резолвятся в приложении.
CREATE TABLE IF NOT EXISTS "Redirect" (
  "id" TEXT NOT NULL,
  "from" TEXT NOT NULL,
  "to" TEXT NOT NULL,
  "hits" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Redirect_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Redirect_from_key" ON "Redirect"("from");
CREATE INDEX IF NOT EXISTS "Redirect_from_idx" ON "Redirect"("from");
