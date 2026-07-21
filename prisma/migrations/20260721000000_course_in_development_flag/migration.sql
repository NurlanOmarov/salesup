-- Флаг «В разработке» на карточке курса: управляется владельцем из админки
-- (раньше бейдж был захардкожен в course-card.tsx по slug !== 'sales-pharma').

ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "inDevelopment" BOOLEAN NOT NULL DEFAULT false;

-- Бэкфилл: сохраняем текущее поведение витрины — все курсы, кроме готового
-- sales-pharma, помечены как «в разработке».
UPDATE "Course" SET "inDevelopment" = true WHERE "slug" <> 'sales-pharma';
