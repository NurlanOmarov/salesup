-- Цена курса с учётом объёма (docs/PRICING-PLAN.md §5.1).
--
-- Причина: курсы различаются по длительности видео в девять раз (39 минут у
-- медпредставителей против 5 ч 51 м у кухонь), а стоили одинаково. Покупатель
-- короткого курса видит длительность прямо на странице и справедливо считает
-- себя обманутым — это возвраты и плохие отзывы там, где их можно не иметь.
--
-- Цена НЕ пропорциональна часам: мы продаём результат, а не хронометраж, и
-- AI-практика (наставник, тренажёры, симулятор) собирается на любой курс
-- независимо от его длины. Поэтому три ступени, а не коэффициент за час:
--
--   Экспресс     (до 1 часа)   SPECIALIZED 350 BYN   EVERYONE 250 BYN
--   Стандарт     (1–3 часа)    SPECIALIZED 490 BYN   EVERYONE 320 BYN
--   Расширенный  (от 3 часов)  SPECIALIZED 590 BYN   EVERYONE 390 BYN
--
-- Объём считается по опубликованным урокам. Курс без видео (каркас «в
-- разработке») получает стандартную ступень — нейтральное предположение,
-- которое пересчитается, когда фабрика зальёт уроки.
--
-- Матрица продублирована в src/lib/pricing (PRICE_MATRIX); при её изменении
-- цены правятся в админке, а не новой миграцией.

WITH volume AS (
  SELECT
    c."id" AS course_id,
    COALESCE(SUM(l."durationSec"), 0) AS total_sec
  FROM "Course" c
  LEFT JOIN "Module" m ON m."courseId" = c."id"
  LEFT JOIN "Lesson" l ON l."moduleId" = m."id" AND l."status" = 'PUBLISHED'
  GROUP BY c."id"
)
UPDATE "Course" c
SET "priceTiyn" = CASE
  WHEN c."audience" = 'EVERYONE' THEN
    CASE
      WHEN v.total_sec > 0 AND v.total_sec < 3600  THEN 25000
      WHEN v.total_sec >= 10800                    THEN 39000
      ELSE 32000
    END
  ELSE
    CASE
      WHEN v.total_sec > 0 AND v.total_sec < 3600  THEN 35000
      WHEN v.total_sec >= 10800                    THEN 59000
      ELSE 49000
    END
END
FROM volume v
WHERE v.course_id = c."id";
