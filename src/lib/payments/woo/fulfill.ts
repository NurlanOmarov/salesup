import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { enqueue } from "@/lib/jobs/enqueue";
import { hashPassword } from "@/lib/auth/password";
import { generateTempPassword } from "@/lib/auth/temp-password";
import { computeExpiry } from "@/lib/admin/enrollment";
import { env } from "@/env";
import {
  orderNumber,
  outcomeOf,
  payerEmail,
  purchasedItems,
  toTiyn,
  type WooOrder,
} from "./order";
import { accessGrantedEmail, ownerPurchaseMessage } from "./notify";

/**
 * Выдача доступа по оплаченному заказу магазина (docs/WOO-INTEGRATION.md).
 *
 * Магазин на activesales.by принимает карту через эквайринг Альфа-Банка и
 * присылает нам факт оплаты. Здесь мы делаем ровно то же, что делал владелец
 * руками в /admin/students: заводим ученика по e-mail, открываем курсы,
 * отдаём временный пароль. Разница только в том, что триггер — webhook.
 *
 * Функция ИДЕМПОТЕНТНА: повторная доставка того же заказа не создаёт второго
 * ученика, второго доступа и второго письма (CLAUDE.md, правило 8).
 */

export type WooResult =
  | { kind: "granted"; email: string; courses: string[]; isNewUser: boolean }
  | { kind: "revoked"; email: string; courses: string[] }
  | { kind: "skipped"; reason: string };

/** Курсы, которым соответствуют позиции заказа: сначала по SKU (= slug), затем по ID товара. */
async function matchCourses(order: WooOrder) {
  const items = purchasedItems(order);
  if (items.length === 0) return [];

  const skus = items.map((i) => i.sku).filter((s): s is string => Boolean(s));
  const productIds = items.map((i) => i.productId);

  const courses = await db.course.findMany({
    where: { OR: [{ slug: { in: skus } }, { wooProductId: { in: productIds } }] },
    select: { id: true, slug: true, title: true, priceTiyn: true, accessDuration: true, wooProductId: true },
  });

  // Позиция → курс: SKU важнее, ID товара — запасной ключ.
  return items.flatMap((item) => {
    const course =
      (item.sku ? courses.find((c) => c.slug === item.sku) : undefined) ??
      courses.find((c) => c.wooProductId === item.productId);
    return course ? [{ item, course }] : [];
  });
}

export async function fulfillWooOrder(order: WooOrder): Promise<WooResult> {
  const outcome = outcomeOf(order.status);
  if (outcome === "ignore") {
    return { kind: "skipped", reason: `статус ${order.status} не требует действий` };
  }

  const matched = await matchCourses(order);
  if (matched.length === 0) {
    // Обычный случай: в магазине 29 товаров, курсов платформы среди них меньше
    // десятка. Заказ на тест или книгу нас не касается.
    return { kind: "skipped", reason: "в заказе нет курсов платформы" };
  }

  const email = payerEmail(order);
  if (!email) {
    // Без e-mail доступ выдать некому. Не бросаем — иначе магазин будет
    // ретраить вечно; вместо этого зовём владельца разобраться вручную.
    await notifyOwner(
      `⚠️ Заказ ${orderNumber(order)} оплачен, но в нём нет e-mail покупателя. Выдайте доступ вручную.`,
    );
    return { kind: "skipped", reason: "в заказе нет e-mail покупателя" };
  }

  return outcome === "paid"
    ? grantAccess(order, email, matched)
    : revokeAccess(order, email, matched);
}

type Matched = Awaited<ReturnType<typeof matchCourses>>;

async function grantAccess(order: WooOrder, email: string, matched: Matched): Promise<WooResult> {
  const now = new Date();
  const number = orderNumber(order);
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });

  // Пароль генерируем только новому ученику: у существующего свой, менять его
  // покупкой нельзя — человек просто получит письмо «доступ открыт».
  const tempPassword = existing ? null : generateTempPassword();
  const passwordHash = tempPassword ? await hashPassword(tempPassword) : null;

  const result = await db.$transaction(async (tx) => {
    const user =
      existing ??
      (await tx.user.create({
        data: { email, role: "STUDENT", passwordHash, mustChangePassword: true },
        select: { id: true },
      }));

    // Заказ платформы — зеркало заказа магазина. Номер уникален, поэтому
    // повторная доставка события находит существующий, а не плодит новый.
    const platformOrder = await tx.order.upsert({
      where: { number: `WOO-${number}` },
      create: {
        number: `WOO-${number}`,
        userId: user.id,
        email,
        status: "PAID",
        subtotalTiyn: matched.reduce((s, m) => s + m.item.totalTiyn, 0),
        totalTiyn: toTiyn(order.total),
        paidAt: order.date_paid_gmt ? new Date(`${order.date_paid_gmt}Z`) : now,
        items: {
          create: matched.map((m) => ({ courseId: m.course.id, priceTiyn: m.item.totalTiyn })),
        },
      },
      update: { status: "PAID", paidAt: now },
      select: { id: true },
    });

    await tx.payment.upsert({
      where: {
        provider_providerPaymentId: {
          provider: "WOOCOMMERCE",
          providerPaymentId: String(order.id),
        },
      },
      create: {
        orderId: platformOrder.id,
        provider: "WOOCOMMERCE",
        providerPaymentId: String(order.id),
        status: "SUCCEEDED",
        amountTiyn: toTiyn(order.total),
        payload: { number, status: order.status, transactionId: order.transaction_id ?? null },
      },
      update: { status: "SUCCEEDED" },
    });

    for (const { course } of matched) {
      const expiresAt = computeExpiry(course.accessDuration, now);
      await tx.enrollment.upsert({
        where: { userId_courseId: { userId: user.id, courseId: course.id } },
        create: {
          userId: user.id,
          courseId: course.id,
          source: "PURCHASE",
          orderId: platformOrder.id,
          startsAt: now,
          expiresAt,
        },
        // Повторная покупка продлевает доступ и снимает отзыв (например, после
        // возврата человек купил снова).
        update: { revokedAt: null, revokedReason: null, expiresAt, orderId: platformOrder.id },
      });
    }

    return { userId: user.id };
  });

  const titles = matched.map((m) => m.course.title);
  await enqueue("email.send", { ...accessGrantedEmail({ email, titles, tempPassword }) });
  await notifyOwner(ownerPurchaseMessage({ number, titles, totalTiyn: toTiyn(order.total), isNewUser: !existing }));

  log.info(
    { orderNumber: number, courses: matched.map((m) => m.course.slug), userId: result.userId },
    "woo: доступ выдан по оплаченному заказу",
  );
  return { kind: "granted", email, courses: matched.map((m) => m.course.slug), isNewUser: !existing };
}

async function revokeAccess(order: WooOrder, email: string, matched: Matched): Promise<WooResult> {
  const number = orderNumber(order);
  const user = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return { kind: "skipped", reason: "возврат по заказу без ученика на платформе" };

  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.enrollment.updateMany({
      where: {
        userId: user.id,
        courseId: { in: matched.map((m) => m.course.id) },
        revokedAt: null,
      },
      data: { revokedAt: now, revokedReason: "woo_refund" },
    });
    await tx.order.updateMany({
      where: { number: `WOO-${number}` },
      data: { status: order.status.includes("refund") ? "REFUNDED" : "CANCELED" },
    });
    await tx.payment.updateMany({
      where: { provider: "WOOCOMMERCE", providerPaymentId: String(order.id) },
      data: { status: "REFUNDED" },
    });
  });

  await notifyOwner(
    `↩️ Заказ ${number} — ${order.status}. Доступ отозван: ${matched.map((m) => m.course.title).join(", ")}.`,
  );
  log.info({ orderNumber: number }, "woo: доступ отозван (возврат/отмена)");
  return { kind: "revoked", email, courses: matched.map((m) => m.course.slug) };
}

/** Сообщение владельцу в Telegram — тот же канал, что и для заявок с сайта. */
async function notifyOwner(text: string): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) return;
  await enqueue("telegram.send", { text });
}
