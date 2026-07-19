-- Переключение базовой валюты цены курса с тенге (KZT) на белорусский рубль (BYN),
-- вслед за переориентацией платформы на рынок Беларуси (CLAUDE.md, 2026-07-16).
-- Поля priceTiyn/oldPriceTiyn сохраняют историческое имя, но отныне хранят
-- BYN-копейки (1 Br = 100 tiyn), а не тенге-тиын. KZT/RUB остаются витринными
-- валютами, пересчитываемыми на лету через lib/currency (кросс-курс НБ РК).
--
-- Единоразовый пересчёт существующих цен по курсу НБ РК на момент миграции
-- (1 BYN = 163.29 KZT, nationalbank.kz, снимок от 2026-07-16 — media/system/currency-rates.json),
-- с округлением до 10 BYN, чтобы получить "красивые" цены в новой базовой валюте.
-- Дальше владелец может поправить цены вручную в /admin/courses при необходимости.

UPDATE "Course"
SET "priceTiyn" = (ROUND("priceTiyn"::numeric / 163.29 / 1000) * 1000)::integer
WHERE "priceTiyn" > 0;

UPDATE "Course"
SET "oldPriceTiyn" = (ROUND("oldPriceTiyn"::numeric / 163.29 / 1000) * 1000)::integer
WHERE "oldPriceTiyn" IS NOT NULL AND "oldPriceTiyn" > 0;

-- OrderItem.priceTiyn — задел будущего платёжного модуля (BACKLOG), в коде пока
-- не используется (в MVP нет онлайн-оплаты), но приводим к той же базе на случай
-- уже существующих строк.
UPDATE "OrderItem"
SET "priceTiyn" = (ROUND("priceTiyn"::numeric / 163.29 / 1000) * 1000)::integer
WHERE "priceTiyn" > 0;
