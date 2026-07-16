-- Минимизация ПДн (правило 9): сертификат не формируется автоматически, ФИО не хранится.
-- Запись живёт как статус READY → ISSUED; ФИО/номер/hash/PDF — опциональны.

-- Статус
CREATE TYPE "CertificateStatus" AS ENUM ('READY', 'ISSUED');
ALTER TABLE "Certificate" ADD COLUMN "status" "CertificateStatus" NOT NULL DEFAULT 'READY';
ALTER TABLE "Certificate" ADD COLUMN "readyAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Ранее выданные сертификаты (реально существовали как выданные) → ISSUED.
UPDATE "Certificate" SET "status" = 'ISSUED';

-- Снимаем NOT NULL / дефолты — эти данные больше не формируются автоматически.
ALTER TABLE "Certificate" ALTER COLUMN "number" DROP NOT NULL;
ALTER TABLE "Certificate" ALTER COLUMN "holderName" DROP NOT NULL;
ALTER TABLE "Certificate" ALTER COLUMN "verifyHash" DROP NOT NULL;
ALTER TABLE "Certificate" ALTER COLUMN "issuedAt" DROP NOT NULL;
ALTER TABLE "Certificate" ALTER COLUMN "issuedAt" DROP DEFAULT;
