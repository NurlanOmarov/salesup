-- Учёт доходов и гонораров + пометка «платный клиент / пилот» у организаций.

CREATE TYPE "OrgBilling" AS ENUM ('PAID', 'PILOT');
CREATE TYPE "SaleChannel" AS ENUM ('B2B', 'B2C');
CREATE TYPE "PayeeRole" AS ENUM ('CO_OWNER', 'AUTHOR');

ALTER TABLE "Organization" ADD COLUMN "billing" "OrgBilling" NOT NULL DEFAULT 'PILOT';

-- Из заведённых организаций оплатила только «Кухни Модуль», остальных пригласили
-- потестить (решение владельца, 2026-09-19).
-- Варианты регистра перечислены явно: при локали C ILIKE кириллицу не сворачивает.
UPDATE "Organization" SET "billing" = 'PAID'
WHERE "name" ILIKE '%кухни%модуль%'
   OR "name" LIKE '%Кухни%Модуль%'
   OR "name" LIKE '%Кухни%модуль%'
   OR "name" LIKE '%КУХНИ%МОДУЛЬ%';

CREATE TABLE "Payee" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "role" "PayeeRole" NOT NULL,
    "shareBp" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payee_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaxRate" (
    "country" TEXT NOT NULL,
    "rateMilli" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxRate_pkey" PRIMARY KEY ("country")
);

CREATE TABLE "Income" (
    "id" TEXT NOT NULL,
    "receivedAt" DATE NOT NULL,
    "channel" "SaleChannel" NOT NULL,
    "country" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "grossTiyn" INTEGER NOT NULL,
    "rateMilli" INTEGER NOT NULL,
    "taxTiyn" INTEGER NOT NULL,
    "netTiyn" INTEGER NOT NULL,
    "orgId" TEXT,
    "courseId" TEXT,
    "buyerRef" TEXT,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Income_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IncomeShare" (
    "id" TEXT NOT NULL,
    "incomeId" TEXT NOT NULL,
    "payeeId" TEXT NOT NULL,
    "shareBp" INTEGER NOT NULL,
    "amountTiyn" INTEGER NOT NULL,

    CONSTRAINT "IncomeShare_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Payee_label_key" ON "Payee"("label");
CREATE INDEX "Income_receivedAt_idx" ON "Income"("receivedAt");
CREATE INDEX "Income_orgId_idx" ON "Income"("orgId");
CREATE INDEX "IncomeShare_payeeId_idx" ON "IncomeShare"("payeeId");
CREATE UNIQUE INDEX "IncomeShare_incomeId_payeeId_key" ON "IncomeShare"("incomeId", "payeeId");

ALTER TABLE "Income" ADD CONSTRAINT "Income_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Income" ADD CONSTRAINT "Income_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IncomeShare" ADD CONSTRAINT "IncomeShare_incomeId_fkey" FOREIGN KEY ("incomeId") REFERENCES "Income"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncomeShare" ADD CONSTRAINT "IncomeShare_payeeId_fkey" FOREIGN KEY ("payeeId") REFERENCES "Payee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Стартовые настройки. Сид эти таблицы не трогает — правятся в /admin/finance.
-- Казахстан: 5 000 налогов с 44 000 = 11,364%; Беларусь, Россия, Узбекистан — 25%.
INSERT INTO "TaxRate" ("country", "rateMilli", "updatedAt") VALUES
  ('KZ', 11364, CURRENT_TIMESTAMP),
  ('BY', 25000, CURRENT_TIMESTAMP),
  ('RU', 25000, CURRENT_TIMESTAMP),
  ('UZ', 25000, CURRENT_TIMESTAMP);

-- Н. — совладелец, 20% чистой прибыли; В. — автор курса, получает остаток.
INSERT INTO "Payee" ("id", "label", "role", "shareBp", "sortOrder") VALUES
  ('payee_n', 'Н.', 'CO_OWNER', 2000, 1),
  ('payee_v', 'В.', 'AUTHOR', NULL, 2);
