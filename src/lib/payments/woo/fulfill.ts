import { db } from "@/lib/db";
import { grantAccess, notifyOwner, revokeAccess, type PaidCourse } from "@/lib/payments/grant";
import { orderNumber, outcomeOf, payerEmail, purchasedItems, toTiyn, type WooOrder } from "./order";

/**
 * Обработка оплаченного заказа магазина WooCommerce (docs/WOO-INTEGRATION.md).
 *
 * Здесь только то, что специфично для магазина: сопоставление товаров с курсами
 * и трактовка статусов заказа. Сама выдача доступа — общая для всех платёжных
 * каналов, в lib/payments/grant.ts.
 */

export type WooResult =
  | { kind: "granted"; email: string; courses: string[]; isNewUser: boolean }
  | { kind: "revoked"; email: string; courses: string[] }
  | { kind: "skipped"; reason: string };

/** Курсы, которым соответствуют позиции заказа: сначала по SKU (= slug), затем по ID товара. */
async function matchCourses(order: WooOrder): Promise<PaidCourse[]> {
  const items = purchasedItems(order);
  if (items.length === 0) return [];

  const skus = items.map((i) => i.sku).filter((s): s is string => Boolean(s));
  const productIds = items.map((i) => i.productId);

  const courses = await db.course.findMany({
    where: { OR: [{ slug: { in: skus } }, { wooProductId: { in: productIds } }] },
    select: { id: true, slug: true, title: true, accessDuration: true, wooProductId: true },
  });

  // Позиция → курс: SKU важнее, ID товара — запасной ключ.
  return items.flatMap((item) => {
    const course =
      (item.sku ? courses.find((c) => c.slug === item.sku) : undefined) ??
      courses.find((c) => c.wooProductId === item.productId);
    return course
      ? [
          {
            id: course.id,
            slug: course.slug,
            title: course.title,
            accessDuration: course.accessDuration,
            paidTiyn: item.totalTiyn,
          },
        ]
      : [];
  });
}

export async function fulfillWooOrder(order: WooOrder): Promise<WooResult> {
  const outcome = outcomeOf(order.status);
  if (outcome === "ignore") {
    return { kind: "skipped", reason: `статус ${order.status} не требует действий` };
  }

  const courses = await matchCourses(order);
  if (courses.length === 0) {
    // Обычный случай: в магазине три десятка товаров, курсов платформы среди них
    // меньше десятка. Заказ на тест или книгу нас не касается.
    return { kind: "skipped", reason: "в заказе нет курсов платформы" };
  }

  const email = payerEmail(order);
  if (!email) {
    // Без e-mail доступ выдать некому. Не бросаем — иначе магазин будет ретраить
    // вечно; вместо этого зовём владельца разобраться вручную.
    await notifyOwner(
      `⚠️ Заказ ${orderNumber(order)} оплачен, но в нём нет e-mail покупателя. Выдайте доступ вручную.`,
    );
    return { kind: "skipped", reason: "в заказе нет e-mail покупателя" };
  }

  const number = `WOO-${orderNumber(order)}`;
  const providerPaymentId = String(order.id);
  const totalTiyn = toTiyn(order.total);

  if (outcome === "paid") {
    const result = await grantAccess({
      email,
      courses,
      orderNumber: number,
      provider: "WOOCOMMERCE",
      providerPaymentId,
      totalTiyn,
      paidAt: order.date_paid_gmt ? new Date(`${order.date_paid_gmt}Z`) : undefined,
      payload: {
        number: orderNumber(order),
        status: order.status,
        transactionId: order.transaction_id ?? null,
      },
    });
    return { kind: "granted", email, courses: result.courses, isNewUser: result.isNewUser };
  }

  const revoked = await revokeAccess({
    email,
    courses,
    orderNumber: number,
    provider: "WOOCOMMERCE",
    providerPaymentId,
    refunded: order.status.includes("refund"),
    reason: "woo_refund",
  });
  return revoked
    ? { kind: "revoked", email, courses: revoked.revoked }
    : { kind: "skipped", reason: "возврат по заказу без ученика на платформе" };
}
