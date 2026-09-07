import type { AccessDuration, PaymentProvider } from "@prisma/client";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { enqueue } from "@/lib/jobs/enqueue";
import { hashPassword } from "@/lib/auth/password";
import { generateTempPassword } from "@/lib/auth/temp-password";
import { computeExpiry } from "@/lib/admin/enrollment";
import { escapeHtml } from "@/lib/notify/escape";
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

/**
 * Курсы, за которые этот человек уже заплатил и доступ к которым у него открыт.
 *
 * Так выглядит случайная двойная оплата: покупатель платил с телефона, зашёл с
 * компьютера, не увидел на карточке подсказку про кабинет (она хранится в
 * браузере) и заплатил ещё раз. Подсказки такой случай не ловят — устройство
 * другое, — поэтому ловим здесь, чтобы владелец вернул деньги.
 *
 * Связи Enrollment → Order в схеме нет, только `orderId`, поэтому номера
 * прошлых заказов забираем вторым запросом.
 */
async function findDoublePayments(
  userId: string,
  courses: PaidCourse[],
  orderNumber: string,
  now: Date,
): Promise<Array<{ title: string; previousOrder: string }>> {
  const active = await db.enrollment.findMany({
    where: {
      userId,
      courseId: { in: courses.map((c) => c.id) },
      source: "PURCHASE",
      revokedAt: null,
      orderId: { not: null },
      // Бессрочный доступ (expiresAt = null) — тоже действующий.
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { courseId: true, orderId: true },
  });
  if (active.length === 0) return [];

  const paidOrders = await db.order.findMany({
    where: { id: { in: active.map((e) => e.orderId!) }, status: "PAID" },
    select: { id: true, number: true },
  });
  const numberById = new Map(paidOrders.map((o) => [o.id, o.number]));

  return active.flatMap((enrollment) => {
    const previousOrder = numberById.get(enrollment.orderId!);
    // Тот же заказ — это повтор обработки одного платежа, а не вторая покупка.
    if (!previousOrder || previousOrder === orderNumber) return [];
    const course = courses.find((c) => c.id === enrollment.courseId);
    return [{ title: course?.title ?? enrollment.courseId, previousOrder }];
  });
}

export async function grantAccess(input: GrantInput): Promise<GrantResult> {
  const now = new Date();
  const { email, courses, orderNumber, provider, providerPaymentId, totalTiyn } = input;
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });

  // Курсы, которые у этого человека уже открыты и оплачены другим заказом.
  // Так выглядит случайная двойная оплата: покупатель платил с телефона, зашёл
  // с компьютера, не увидел подсказку про кабинет и заплатил ещё раз. Подсказки
  // в интерфейсе такой случай не ловят — устройство другое, — поэтому ловим здесь.
  const alreadyPaid = existing ? await findDoublePayments(existing.id, courses, orderNumber, now) : [];

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

  // Деньги списаны дважды за то, что у человека и так есть, — это возврат, и
  // решает его владелец. Номера заказов хватает, чтобы найти оба платежа в
  // кабинете банка; e-mail покупателя в уведомление не кладём (правило 9).
  for (const duplicate of alreadyPaid) {
    await notifyOwner(
      `⚠️ <b>Повторная оплата</b>\n` +
        `Курс: ${escapeHtml(duplicate.title)}\n` +
        `Заказы: ${escapeHtml(duplicate.previousOrder)} и ${escapeHtml(orderNumber)}\n` +
        `Доступ у покупателя уже был — похоже на случайную оплату, проверьте и верните деньги.`,
    );
  }

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

/**
 * Сообщение владельцу в Telegram — тот же канал, что и для заявок с сайта.
 *
 * Проверять здесь наличие токена нельзя: отправляет worker, и токен есть только
 * у него, а приложение задачу лишь ставит в очередь. Проверка в приложении
 * молча гасила все уведомления об оплатах.
 */
export async function notifyOwner(text: string): Promise<void> {
  await enqueue("telegram.send", { text });
}
