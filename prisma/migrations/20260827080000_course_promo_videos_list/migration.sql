-- Промо-роликов на карточке может быть несколько (у DIY — три шортса тренера),
-- поэтому одиночные promoYoutubeId/promoYoutubeVertical заменяем списком.
ALTER TABLE "Course" ADD COLUMN "promoVideos" JSONB;

-- Переносим уже заполненные ролики в новый формат.
UPDATE "Course"
SET "promoVideos" = jsonb_build_array(
  jsonb_build_object('id', "promoYoutubeId", 'vertical', "promoYoutubeVertical")
)
WHERE "promoYoutubeId" IS NOT NULL;

ALTER TABLE "Course" DROP COLUMN "promoYoutubeId";
ALTER TABLE "Course" DROP COLUMN "promoYoutubeVertical";

-- Курс «Продажи в DIY»: к ролику о курсе добавляем два тематических шортса.
-- Подписи не задаём: на самих кадрах крупные титры тренера, а названия роликов
-- на YouTube с ними расходятся — подпись под превью только запутает.
UPDATE "Course"
SET "promoVideos" = '[
  {"id": "8BpOtMv_Qzk", "vertical": true},
  {"id": "ctzDBxj4Ctc", "vertical": true},
  {"id": "h4lIYHm6PpU", "vertical": true}
]'::jsonb
WHERE "slug" = 'sales-diy';
