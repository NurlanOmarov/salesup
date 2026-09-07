import { z } from "zod";
import { env } from "@/env";
import { log } from "@/lib/log";

/**
 * Запрос состояния заказа у платёжного шлюза — `getOrderStatusExtended.do`
 * (docs/ALFA-PAYMENT-LINKS.md §2.7).
 *
 * Нужен потому, что штатное callback-уведомление короткое: заказ, событие и
 * подпись. E-mail плательщика и наш параметр `course` живут в карточке заказа,
 * и когда их нет в уведомлении, мы забираем их отсюда.
 *
 * Из карточки берём ровно четыре вещи: e-mail, параметр course, сумму и номер
 * заказа. Данные карты в ответе тоже есть (маскированный номер, имя держателя) —
 * их не читаем и не сохраняем.
 */

const paramSchema = z.object({ name: z.string(), value: z.string().nullish() });

const responseSchema = z.object({
  errorCode: z.union([z.string(), z.number()]).optional(),
  errorMessage: z.string().optional(),
  /** 2 — заказ оплачен (одностадийная оплата завершена). */
  orderStatus: z.number().optional(),
  orderNumber: z.string().optional(),
  amount: z.number().optional(),
  currency: z.union([z.string(), z.number()]).optional(),
  orderDescription: z.string().nullish(),
  /** Параметры заказа: сюда попадает наш `course` и поля предплатежной страницы. */
  merchantOrderParams: z.array(paramSchema).optional(),
  attributes: z.array(paramSchema).optional(),
  /** Блок с данными плательщика — присутствует не у всех мерчантов. */
  payerData: z.object({ email: z.string().nullish(), phone: z.string().nullish() }).nullish(),
  customerDetails: z.object({ email: z.string().nullish() }).nullish(),
});

export interface AlfaOrderDetails {
  /** E-mail с предплатежной страницы; null — если шлюз его не отдал. */
  email: string | null;
  /** Значение параметра `course` — адрес курса на платформе. */
  course: string | null;
  /** Описание заказа — по нему тоже можно опознать курс. */
  description: string | null;
  /** Сумма заказа в копейках. */
  amountTiyn: number;
  orderNumber: string | null;
  /** Оплачен ли заказ по мнению шлюза (orderStatus === 2). */
  paid: boolean;
}

export function alfaApiConfigured(): boolean {
  return Boolean(env.ALFA_API_LOGIN && env.ALFA_API_PASSWORD);
}

/** Ищем значение параметра по имени в merchantOrderParams и attributes. */
function findParam(
  lists: Array<Array<{ name: string; value?: string | null }> | undefined>,
  name: string,
): string | null {
  const wanted = name.toLowerCase();
  for (const list of lists) {
    const found = list?.find((p) => p.name.trim().toLowerCase() === wanted);
    const value = found?.value?.trim();
    if (value) return value;
  }
  return null;
}

/**
 * Карточка заказа по его идентификатору в шлюзе (`mdOrder` из уведомления).
 * Бросает при сетевой ошибке и при ошибке шлюза — вызывающий решает, повторять
 * ли обработку.
 */
export async function fetchOrderDetails(mdOrder: string): Promise<AlfaOrderDetails> {
  if (!alfaApiConfigured()) throw new Error("alfa: ALFA_API_LOGIN/PASSWORD не заданы");

  const url = new URL("getOrderStatusExtended.do", env.ALFA_API_URL);
  const body = new URLSearchParams({
    userName: env.ALFA_API_LOGIN!,
    password: env.ALFA_API_PASSWORD!,
    orderId: mdOrder,
    language: "ru",
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`alfa getOrderStatusExtended: HTTP ${res.status}`);

  const parsed = responseSchema.safeParse(await res.json());
  if (!parsed.success) throw new Error("alfa getOrderStatusExtended: неожиданный формат ответа");

  const data = parsed.data;
  // Шлюз отвечает HTTP 200 даже на отказ: успех определяется errorCode.
  if (data.errorCode !== undefined && String(data.errorCode) !== "0") {
    throw new Error(`alfa getOrderStatusExtended: ошибка ${data.errorCode} ${data.errorMessage ?? ""}`);
  }

  const lists = [data.merchantOrderParams, data.attributes];
  const email =
    data.payerData?.email?.trim() ||
    data.customerDetails?.email?.trim() ||
    findParam(lists, "email") ||
    null;

  log.info(
    { mdOrder, orderStatus: data.orderStatus, hasEmail: Boolean(email) },
    "alfa: получена карточка заказа",
  );

  return {
    email: email ? email.toLowerCase() : null,
    course: findParam(lists, "course"),
    description: data.orderDescription?.trim() || null,
    amountTiyn: data.amount ?? 0,
    orderNumber: data.orderNumber ?? null,
    paid: data.orderStatus === 2,
  };
}
