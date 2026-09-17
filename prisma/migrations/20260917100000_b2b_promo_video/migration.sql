-- Курс «B2B-переговоры и крупные сделки»: вертикальное промо (Shorts) на карточку.
-- Как и остальные промо, видео остаётся на YouTube.
UPDATE "Course"
SET "promoVideos" = '[{"id": "1KRI6JCGv00", "vertical": true}]'::jsonb
WHERE "slug" = 'sales-b2b';
