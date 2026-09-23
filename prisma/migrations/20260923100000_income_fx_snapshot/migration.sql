-- Снимок курса НБ РК на момент записи поступления: журнал доходов показывает
-- сумму и в тенге, и в белорусских рублях по курсу того дня. Старые записи
-- остаются с NULL — они пересчитываются по текущему курсу с пометкой.

ALTER TABLE "Income" ADD COLUMN "kztPerUnitMicro" INTEGER;
ALTER TABLE "Income" ADD COLUMN "kztPerBynMicro" INTEGER;
