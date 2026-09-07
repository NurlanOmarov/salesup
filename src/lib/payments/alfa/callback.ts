import { z } from "zod";

/**
 * Разбор callback-уведомления Альфа-Банка (docs/ALFA-PAYMENT-LINKS.md §7).
 *
 * Уведомление приходит набором плоских параметров — в query (GET) или в теле
 * (POST). Обязательны только `mdOrder`, `operation`, `status` и `checksum`;
 * остальное шлюз добавляет по настройкам мерчанта, поэтому схема мягкая, а
 * недостающее (e-mail, курс) добирается запросом getOrderStatusExtended.do.
 */

export const alfaCallbackSchema = z.object({
  /** Идентификатор заказа в платёжном шлюзе (UUID) — ключ ко всем запросам API. */
  mdOrder: z.string().min(1),
  /** Номер заказа в системе мерчанта; при оплате по ссылке его формирует шлюз. */
  orderNumber: z.string().optional(),
  operation: z.string().min(1),
  /** «1» — операция успешна, «0» — нет. */
  status: z.string().min(1),
  checksum: z.string().optional(),
  amount: z.string().optional(),
  // Ниже — дополнительные параметры уведомления: приходят, только если
  // отмечены в кабинете (Настройки → Мерчант → Callback уведомления).
  /** E-mail покупателя с предплатежной страницы — по нему выдаётся доступ. */
  payerEmail: z.string().optional(),
  /** Запасное имя того же поля на случай другой настройки шлюза. */
  email: z.string().optional(),
  /** Описание заказа — берётся из описания платёжной ссылки. */
  orderDescription: z.string().optional(),
  /** Название заказа — берётся из названия платёжной ссылки. */
  name: z.string().optional(),
  /**
   * Наш параметр из платёжной ссылки. В списке дополнительных параметров
   * кабинета его нет, поэтому обычно не приходит — курс определяется по
   * описанию и названию заказа (lib/payments/alfa/course.ts). Оставлен на
   * случай, если банк включит передачу пользовательских параметров.
   */
  course: z.string().optional(),
});

export type AlfaCallback = z.infer<typeof alfaCallbackSchema>;

export type AlfaOutcome = "paid" | "revoked" | "ignore";

/**
 * Что делать по уведомлению.
 *
 * `deposited` — деньги списаны, это единственное событие, открывающее доступ.
 * `approved` при одностадийной оплате приходит как промежуточное, поэтому
 * доступ по нему не выдаём — иначе холд без списания дал бы курс бесплатно.
 */
export function outcomeOf(operation: string, status: string): AlfaOutcome {
  const op = operation.trim().toLowerCase();
  const ok = status.trim() === "1";

  if (op === "deposited" && ok) return "paid";
  if ((op === "refunded" || op === "reversed") && ok) return "revoked";
  return "ignore";
}

/**
 * Ключ идемпотентности для WebhookEvent: заказ шлюза + событие. Повторная
 * доставка того же события отсекается, смена статуса обрабатывается как новое.
 */
export function alfaEventId(callback: AlfaCallback): string {
  const op = callback.operation.trim().toLowerCase();
  return `order:${callback.mdOrder}:${op}:${callback.status.trim()}`;
}

/**
 * Параметры запроса в плоский словарь строк: подпись считается по тому набору,
 * который реально пришёл, поэтому важно сохранить все параметры как есть.
 */
export function paramsFromSearch(params: URLSearchParams): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of params.entries()) result[key] = value;
  return result;
}

/**
 * Тело POST-уведомления. Шлюз отправляет его как `application/x-www-form-urlencoded`,
 * но встречаются и настройки с JSON — принимаем оба формата.
 */
export function paramsFromBody(raw: string): Record<string, string> {
  const body = raw.trim();
  if (!body) return {};

  if (body.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(body);
      if (parsed && typeof parsed === "object") {
        return Object.fromEntries(
          Object.entries(parsed as Record<string, unknown>).map(([k, v]) => [k, String(v)]),
        );
      }
    } catch {
      return {};
    }
    return {};
  }

  return paramsFromSearch(new URLSearchParams(body));
}
