-- Ссылка на карточку в Google Картах была собрана из несуществующего place_id и
-- открывала пустую карточку. Правильная короткая форма — по cid организации
-- (0x595bc01719e0aafe из ссылки на карточку → 6438951297707191038).
UPDATE "ExternalReview"
SET "url" = 'https://www.google.com/maps?cid=6438951297707191038'
WHERE "source" = 'GOOGLE';

UPDATE "SeoSettings"
SET "googleMapsUrl" = 'https://www.google.com/maps?cid=6438951297707191038'
WHERE "googleMapsUrl" LIKE '%place_id:ChIJazavO42_20YRvqrgGRfAW1k%';
