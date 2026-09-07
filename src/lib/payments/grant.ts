import type { AccessDuration, PaymentProvider } from "@prisma/client";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { enqueue } from "@/lib/jobs/enqueue";
import { hashPassword } from "@/lib/auth/password";
import { generateTempPassword } from "@/lib/auth/temp-password";
import { computeExpiry } from "@/lib/admin/enrollment";
import { env } from "@/env";
import { accessGrantedEmail, ownerPurchaseMessage } from "./notify";

/**
 * Выдача и отзыв доступа по оплате — общий код всех платёжных каналов
 * (ссылки Альфа-Банка, магазин WooCommerce; docs/ALFA-PAYMENT-LINKS.md,
 * docs/WOO-INTEGRATION.md).
 *
 * Делает ровно то же, что владелец делал руками в /admin/students: заводит
 * ученика по e-mail, открывает курсы на срок тарифа, отдаёт временный пароль.
 * Разница только в том, что триггер — уведомление об оплате.
 *
 * ИДЕМПОТЕНТНО: повторная обработка того же платежа не создаёт второго ученика,
 * второго доступа и второго письма (CLAUDE.md, правило 8).
 */

/** Курс, за который заплатили, и сумма именно этой позиции. */
export interface PaidCourse {
  id: string;
  slug: string;
  title: string;
  accessDuration: AccessDuration;
  /** Сколько заплачено за этот курс, в копейках. */
  paidTiyn: number;
}

export interface GrantInput {
  /** E-mail плательщика — единственные ПДн, которые платформа берёт из платежа. */
  email: string;
  courses: PaidCourse[];
  /** Номер заказа платформы: `ALFA-30412`, `WOO-30412`. Уникален — служит ключом повтора. */
  orderNumber: string;
  provider: PaymentProvider;
  /** Идентификатор платежа у провайдера (для @@unique([provider, providerPaymentId])). */
  providerPaymentId: string;
  /** Сумма всего платежа в копейках. */
  totalTiyn: number;
  paidAt?: Date;
  /** Что положить в Payment.payload — без карточных данных и без ПДн. */
  payload?: Record<string, unknown>;
}

export interface GrantResult {
  userId: string;
  isNewUser: boolean;
  courses: string[];
}

export async function grantAccess(input: GrantInput): Promise<GrantResult> {
  const now = new Date();
  const { email, courses, orderNumber, provider, providerPaymentId, totalTiyn } = input;
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });

  // Пароль генерируем только новому ученику: у существующего свой, и менять его
  // покупкой нельзя — человек просто получит письмо «доступ открыт».
  const tempPassword = existing ? null : generateTempPassword();
  const passwordHash = tempPassword ? await hashPassword(tempPassword) : null;

  const { userId } = await db.$transaction(async (tx) => {
    const user =
      existing ??
      (await tx.user.create({
        data: { email, role: "STUDENT", passwordHash, mustChangePassword: true },
        select: { id: true },
      }));

    // Заказ платформы — зеркало платежа у провайдера. Номер уникален, поэтому
    // повторная обработка находит существующий заказ, а не плодит новый.
    const order = await tx.order.upsert({
      where: { number: orderNumber },
      create: {
        number: orderNumber,
        userId: user.id,
        email,
        status: "PAID",
        subtotalTiyn: courses.reduce((sum, c) => sum + c.paidTiyn, 0),
        totalTiyn,
        paidAt: input.paidAt ?? now,
        items: { create: courses.map((c) => ({ courseId: c.id, priceTiyn: c.paidTiyn })) },
      },
      update: { status: "PAID", paidAt: input.paidAt ?? now },
      select: { id: true },
    });

    await tx.payment.upsert({
      where: { provider_providerPaymentId: { provider, providerPaymentId } },
      create: {
        orderId: order.id,
        provider,
        providerPaymentId,
        status: "SUCCEEDED",
        amountTiyn: totalTiyn,
        payload: (input.payload ?? {}) as object,
      },
      update: { status: "SUCCEEDED" },
    });

    for (const course of courses) {
      const expiresAt = computeExpiry(course.accessDuration, now);
      await tx.enrollment.upsert({
        where: { userId_courseId: { userId: user.id, courseId: course.id } },
        create: {
          userId: user.id,
          courseId: course.id,
          source: "PURCHASE",
          orderId: order.id,
          startsAt: now,
          expiresAt,
        },
        // Повторная покупка продлевает доступ и снимает отзыв — например, когда
        // после возврата человек купил курс снова.
        update: { revokedAt: null, revokedReason: null, expiresAt, orderId: order.id },
      });
    }

    return { userId: user.id };
  });

  const titles = courses.map((c) => c.title);
  await enqueue("email.send", { ...accessGrantedEmail({ email, titles, tempPassword }) });
  await notifyOwner(
    ownerPurchaseMessage({
      number: orderNumber,
      titles,
      totalTiyn,
      isNewUser: !existing,
      email,
      tempPassword,
    }),
  );

  log.info(
    { orderNumber, provider, courses: courses.map((c) => c.slug), userId },
    "payments: доступ выдан по оплате",
  );
  return { userId, isNewUser: !existing, courses: courses.map((c) => c.slug) };
}

export interface RevokeInput {
  email: string;
  courses: PaidCourse[];
  orderNumber: string;
  provider: PaymentProvider;
  providerPaymentId: string;
  /** true — деньги вернулись (refund), false — платёж отменён до списания. */
  refunded: boolean;
  reason: string;
}

export async function revokeAccess(input: RevokeInput): Promise<{ revoked: string[] } | null> {
  const { email, courses, orderNumber, provider, providerPaymentId, refunded } = input;
  const user = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return null;

  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.enrollment.updateMany({
      where: { userId: user.id, courseId: { in: courses.map((c) => c.id) }, revokedAt: null },
      data: { revokedAt: now, revokedReason: input.reason },
    });
    await tx.order.updateMany({
      where: { number: orderNumber },
      data: { status: refunded ? "REFUNDED" : "CANCELED" },
    });
    await tx.payment.updateMany({
      where: { provider, providerPaymentId },
      data: { status: refunded ? "REFUNDED" : "FAILED" },
    });
  });

  await notifyOwner(
    `↩️ Заказ ${orderNumber}: ${refunded ? "возврат средств" : "платёж отменён"}. ` +
      `Доступ отозван: ${courses.map((c) => c.title).join(", ")}.`,
  );
  log.info({ orderNumber, provider }, "payments: доступ отозван (возврат/отмена)");
  return { revoked: courses.map((c) => c.slug) };
}

/** Сообщение владельцу в Telegram — тот же канал, что и для заявок с сайта. */
export async function notifyOwner(text: string): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) return;
  await enqueue("telegram.send", { text });
}
