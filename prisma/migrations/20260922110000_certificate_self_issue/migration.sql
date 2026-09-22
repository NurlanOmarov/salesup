-- Автоматическая выдача сертификата (D-019): ученик вводит ФИО и даёт согласие,
-- PDF выпускается сразу и уходит на почту ответственного (B2B) или ученика.
ALTER TABLE "Certificate" ADD COLUMN "consentAt" TIMESTAMP(3);
ALTER TABLE "Certificate" ADD COLUMN "consentVersion" TEXT;
ALTER TABLE "Certificate" ADD COLUMN "emailedAt" TIMESTAMP(3);
ALTER TABLE "Certificate" ADD COLUMN "emailedTo" TEXT;

ALTER TABLE "Course" ADD COLUMN "certificateCourseTitle" TEXT;
ALTER TABLE "Course" ADD COLUMN "certificateLead" TEXT;

-- Номер сертификата по образцу школы «№5000/22.09.2026»: сквозной счётчик.
-- 5000 уже занят образцом, выданным вручную, — автоматические начинаются с 5001.
CREATE SEQUENCE IF NOT EXISTS certificate_number_seq START 5001;

-- «Продажи в DIY-магазине» — вводная часть основного курса (значения — как в образце
-- сертификата школы; продублированы в prisma/seed.ts).
UPDATE "Course"
SET "certificateCourseTitle" = 'Эффективные продажи в DIY',
    "certificateLead" = 'вводную часть бизнес-курса онлайн'
WHERE slug = 'sales-diy';
