-- Ломбард: промо — видео-презентация тренинга (49 с), сжатый MP4 на нашем
-- сервере. Ставим, только если список пуст (после 20260925100000), — правки
-- из админки не затираем.
UPDATE "Course" SET "promoVideos" = '[{"id": "promo-1", "file": "courses/service-pawnshop/promo/promo-1.mp4", "vertical": false}]'::jsonb
WHERE "slug" = 'service-pawnshop' AND "promoVideos" = '[]'::jsonb;
