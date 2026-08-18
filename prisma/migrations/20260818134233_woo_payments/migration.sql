-- Оплата курсов через магазин WooCommerce на activesales.by (docs/WOO-INTEGRATION.md).

-- AlterEnum: источник платежа — магазин на белорусском домене (эквайринг Альфа-Банка).
ALTER TYPE "PaymentProvider" ADD VALUE 'WOOCOMMERCE';

-- AlterTable: связь курса с товаром магазина (запасной ключ к SKU = slug).
ALTER TABLE "Course" ADD COLUMN "wooProductId" INTEGER;

-- CreateIndex: один товар — один курс.
CREATE UNIQUE INDEX "Course_wooProductId_key" ON "Course"("wooProductId");
