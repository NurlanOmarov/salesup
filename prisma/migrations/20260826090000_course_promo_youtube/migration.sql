-- Промо-ролик курса остаётся на YouTube: храним только ID видео.
ALTER TABLE "Course" ADD COLUMN "promoYoutubeId" TEXT;

-- Курс «Продажи в магазине обуви и одежды» — ролик «Содержание видео-уроков
-- по продажам обуви в розницу за 1 минуту» с activesales.by.
UPDATE "Course" SET "promoYoutubeId" = 'OXDSOlTZg_Y' WHERE "slug" = 'sales-shoes';

-- Вертикальные ролики (YouTube Shorts) показываем 9:16, а не в 16:9-рамке.
ALTER TABLE "Course" ADD COLUMN "promoYoutubeVertical" BOOLEAN NOT NULL DEFAULT false;

-- Курс «Продажи строительных материалов» — вертикальный ролик-шортс.
UPDATE "Course"
SET "promoYoutubeId" = '8BpOtMv_Qzk', "promoYoutubeVertical" = true
WHERE "slug" = 'sales-diy';
