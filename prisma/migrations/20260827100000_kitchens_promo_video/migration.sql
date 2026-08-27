-- Курс «Эффективные продажи кухонь 2.0»: промо-ролик тренера с карточки товара
-- на activesales.by. Как и остальные промо, видео остаётся на YouTube.
UPDATE "Course"
SET "promoVideos" = '[{"id": "W2EIMlXSmQs", "vertical": false}]'::jsonb
WHERE "slug" = 'sales-kitchens';
