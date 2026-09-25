-- Промо-ролики витрины переезжают с YouTube на наш сервер: сжатые MP4 в
-- каталоге promo курса (pnpm factory:promo, lib/courses/promo-video.ts).
-- Меняем только там, где в базе всё ещё прежний YouTube-список, — правки
-- из админки не затираем.

UPDATE "Course" SET "promoVideos" = '[{"id": "promo-1", "file": "courses/sales-b2b/promo/promo-1.mp4", "vertical": true}]'::jsonb
WHERE "slug" = 'sales-b2b' AND "promoVideos" = '[{"id": "1KRI6JCGv00", "vertical": true}]'::jsonb;

UPDATE "Course" SET "promoVideos" = '[{"id": "promo-1", "file": "courses/sales-diy/promo/promo-1.mp4", "vertical": true}, {"id": "promo-2", "file": "courses/sales-diy/promo/promo-2.mp4", "vertical": true}, {"id": "promo-3", "file": "courses/sales-diy/promo/promo-3.mp4", "vertical": true}]'::jsonb
WHERE "slug" = 'sales-diy' AND "promoVideos" = '[{"id": "8BpOtMv_Qzk", "vertical": true}, {"id": "ctzDBxj4Ctc", "vertical": true}, {"id": "h4lIYHm6PpU", "vertical": true}]'::jsonb;

UPDATE "Course" SET "promoVideos" = '[{"id": "promo-1", "file": "courses/sales-kitchens/promo/promo-1.mp4", "vertical": false}]'::jsonb
WHERE "slug" = 'sales-kitchens' AND "promoVideos" = '[{"id": "W2EIMlXSmQs", "vertical": false}]'::jsonb;

UPDATE "Course" SET "promoVideos" = '[{"id": "promo-1", "file": "courses/sales-kitchens-basics/promo/promo-1.mp4", "vertical": false}]'::jsonb
WHERE "slug" = 'sales-kitchens-basics' AND "promoVideos" = '[{"id": "PPldpQy4Oks", "vertical": false}]'::jsonb;

UPDATE "Course" SET "promoVideos" = '[{"id": "promo-1", "file": "courses/sales-mattresses/promo/promo-1.mp4", "vertical": true}]'::jsonb
WHERE "slug" = 'sales-mattresses' AND "promoVideos" = '[{"id": "zUTNMRRxx7c", "vertical": true}]'::jsonb;

UPDATE "Course" SET "promoVideos" = '[{"id": "promo-1", "file": "courses/sales-shoes/promo/promo-1.mp4", "vertical": false}]'::jsonb
WHERE "slug" = 'sales-shoes' AND "promoVideos" = '[{"id": "OXDSOlTZg_Y", "vertical": false}]'::jsonb;

-- Ломбард: «промо» было самой записью тренинга (54 мин) — это и есть уроки
-- курса, бесплатно на витрине их не отдаём. Блока роликов у курса нет.
UPDATE "Course" SET "promoVideos" = '[]'::jsonb
WHERE "slug" = 'service-pawnshop' AND "promoVideos" = '[{"id": "pRAvDN-yy4I", "vertical": false}]'::jsonb;
