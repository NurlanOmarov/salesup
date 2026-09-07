-- Оплата курсов ссылками Альфа-Банка (docs/ALFA-PAYMENT-LINKS.md).

-- AlterEnum: платёж по ссылке на странице банка.
ALTER TYPE "PaymentProvider" ADD VALUE 'ALFA';

-- AlterTable: постоянная платёжная ссылка курса из личного кабинета эквайринга.
ALTER TABLE "Course" ADD COLUMN "alfaPaymentUrl" TEXT;
