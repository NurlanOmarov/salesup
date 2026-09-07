import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { escapeHtml } from "@/lib/notify/escape";
import { formatCurrency } from "@/lib/currency/format";
import { grantAccess, notifyOwner, revokeAccess, type PaidCourse } from "@/lib/payments/grant";
import { outcomeOf, type AlfaCallback } from "./callback";
import { fetchOrderDetails, alfaApiConfigured } from "./status";
import { matchCourseFromText } from "./course";

/**
 * Обработка уведомления об оплате по ссылке Альфа-Банка
 * (docs/ALFA-PAYMENT-LINKS.md).
 *
 * Специфика канала здесь только одна: понять, какой курс оплачен и на какой
 * e-mail выдавать доступ. Курс определяет параметр `course`, зашитый в платёжную
 * ссылку; e-mail покупатель вводит на предплатежной странице. Если шлюз не
 * прислал их в уведомлении, забираем карточку заказа через API.
 *
 * Сама выдача доступа — общая для всех каналов, в lib/payments/grant.ts.
 */

export type AlfaResult =
  | { kind: "granted"; email: string; courses: string[]; isNewUser: boolean }
  | { kind: "revoked"; email: string; courses: string[] }
  | { kind: "skipped"; reason: string };

async function findCourse(slug: string): Promise<PaidCourse | null> {
  const course = await db.course.findUnique({
    where: { slug },
    select: { id: true, slug: true, title: true, accessDuration: true, priceTiyn: true },
  });
  if (!course) return null;
  return { ...course, paidTiyn: course.priceTiyn };
}

export async function fulfillAlfaCallback(callback: AlfaCallback): Promise<AlfaResult> {
  const outcome = outcomeOf(callback.operation, callback.status);
  if (outcome === "ignore") {
    return {
      kind: "skipped",
      reason: `операция ${callback.operation} со статусом ${callback.status} действий не требует`,
    };
  }

  // Что придёт в уведомлении, зависит от дополнительных параметров, отмеченных
  // в кабинете: e-mail покупателя (payerEmail) там есть, а пользовательский
  // параметр `course` — нет, поэтому курс ищем в описании и названии заказа.
  let email = (callback.payerEmail ?? callback.email)?.trim().toLowerCase() || null;
  let course = callback.course?.trim() || null;
  let amountTiyn = callback.amount ? Number(callback.amount) : 0;
  let orderNumber = callback.orderNumber ?? null;
  let description = callback.orderDescription ?? null;
  const name = callback.name ?? null;

  if (!course) {
    const candidates = await db.course.findMany({ select: { slug: true, title: true } });
    course = matchCourseFromText([description, name], candidates)?.slug ?? null;
  }

  // Последний рубеж: если параметров не хватило, а доступы к API есть — берём
  // карточку заказа целиком. Без доступов просто идём дальше с тем, что есть.
  if ((!email || !course) && alfaApiConfigured()) {
    try {
      const details = await fetchOrderDetails(callback.mdOrder);
      email = email ?? details.email;
      amountTiyn = amountTiyn || details.amountTiyn;
      orderNumber = orderNumber ?? details.orderNumber;
      description = description ?? details.description;
      if (!course) {
        const candidates = await db.course.findMany({ select: { slug: true, title: true } });
        course =
          details.course ?? matchCourseFromText([details.description], candidates)?.slug ?? null;
      }
    } catch (error) {
      log.warn({ mdOrder: callback.mdOrder, err: error }, "alfa: не удалось получить карточку заказа");
    }
  }

  const number = `ALFA-${orderNumber ?? callback.mdOrder}`;

  if (!course) {
    // Callback настроен на уровне мерчанта, поэтому сюда приходят и оплаты
    // магазина activesales.by — в них параметра course нет и быть не должно:
    // такие заказы обрабатывает свой канал (docs/WOO-INTEGRATION.md).
    // Отличить их от неверно настроенной платёжной ссылки платформа не может,
    // поэтому сообщаем владельцу мягко и с обоими вариантами объяснения.
    await notifyOwner(
      `ℹ️ Оплата ${escapeHtml(number)} на ${escapeHtml(formatCurrency(amountTiyn, "BYN", {}))} ` +
        `пришла без параметра «course».\n` +
        `Если это покупка в магазине activesales.by — всё в порядке, доступ выдаст канал магазина.\n` +
        `Если это курс по платёжной ссылке — выдайте доступ вручную и проверьте параметр в ссылке.`,
    );
    log.info({ orderNumber: number }, "alfa: уведомление без параметра course — пропущено");
    return { kind: "skipped", reason: "в заказе нет параметра course" };
  }

  const paidCourse = await findCourse(course);
  if (!paidCourse) {
    await notifyOwner(
      `⚠️ Оплата по заказу ${number}: курс «${course}» на платформе не найден. ` +
        `Проверьте значение параметра «course» в платёжной ссылке.`,
    );
    return { kind: "skipped", reason: `курс ${course} на платформе не найден` };
  }

  if (!email) {
    await notifyOwner(
      `⚠️ Оплачен курс «${paidCourse.title}» (заказ ${number}), но e-mail покупателя неизвестен. ` +
        `Найдите его в кабинете банка и выдайте доступ вручную.`,
    );
    return { kind: "skipped", reason: "в заказе нет e-mail покупателя" };
  }

  // Сумма платежа — то, что реально списано; цена курса могла с тех пор поменяться.
  const total = amountTiyn > 0 ? amountTiyn : paidCourse.paidTiyn;
  const courses: PaidCourse[] = [{ ...paidCourse, paidTiyn: total }];

  if (outcome === "paid") {
    const result = await grantAccess({
      email,
      courses,
      orderNumber: number,
      provider: "ALFA",
      providerPaymentId: callback.mdOrder,
      totalTiyn: total,
      payload: {
        operation: callback.operation,
        status: callback.status,
        orderNumber: orderNumber ?? null,
        course,
      },
    });
    log.info({ orderNumber: number, course }, "alfa: доступ выдан по оплате");
    return { kind: "granted", email, courses: result.courses, isNewUser: result.isNewUser };
  }

  const revoked = await revokeAccess({
    email,
    courses,
    orderNumber: number,
    provider: "ALFA",
    providerPaymentId: callback.mdOrder,
    refunded: callback.operation.trim().toLowerCase() === "refunded",
    reason: "alfa_refund",
  });
  return revoked
    ? { kind: "revoked", email, courses: revoked.revoked }
    : { kind: "skipped", reason: "возврат по заказу без ученика на платформе" };
}
