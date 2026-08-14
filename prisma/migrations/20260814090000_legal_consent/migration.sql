-- Фиксация акцепта юридических документов (публичная оферта + политика ПДн).
-- Закон РБ № 99-З требует доказуемого согласия субъекта, а ГК РБ (ст. 408) —
-- подтверждаемого акцепта оферты. Храним только момент и версию редакции:
-- IP и user-agent не пишем (CLAUDE.md правило 9 — минимизация ПДн).

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "termsVersion" TEXT;

ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "consentAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "consentVersion" TEXT;
