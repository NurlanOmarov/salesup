-- Контакты поддержки в SeoSettings (телефон + WhatsApp, правятся в /admin/seo).
-- Backfill: существующие NULL-телефоны заполняем дефолтом ДО SET NOT NULL.

ALTER TABLE "SeoSettings" ADD COLUMN "supportWhatsapp" TEXT NOT NULL DEFAULT 'https://wa.me/375296053032';

UPDATE "SeoSettings" SET "orgPhone" = '+375 (29) 605-30-32' WHERE "orgPhone" IS NULL;

ALTER TABLE "SeoSettings" ALTER COLUMN "orgPhone" SET DEFAULT '+375 (29) 605-30-32';
ALTER TABLE "SeoSettings" ALTER COLUMN "orgPhone" SET NOT NULL;
