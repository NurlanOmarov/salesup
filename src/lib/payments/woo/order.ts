import { z } from "zod";

/**
 * Разбор заказа WooCommerce (docs/WOO-INTEGRATION.md).
 *
 * Магазин присылает заказ целиком, но нам нужен минимум: номер, статус, сумма,
 * e-mail плательщика и позиции. Имя, телефон и адрес из billing НЕ читаем и не
 * храним — платформа обходится одним e-mail (CLAUDE.md, правило 9). Поэтому
 * схема их просто не описывает: лишние поля zod отбрасывает.
 */

const lineItemSchema = z.object({
  id: z.number().int().optional(),
  product_id: z.number().int(),
  /** Артикул товара; договорённость с магазином: SKU = slug курса. */
  sku: z.string().nullish(),
  name: z.string().nullish(),
  quantity: z.number().int().nullish(),
  /** Сумма позиции без налога, строкой («350.00»). */
  total: z.string().nullish(),
});

export const wooOrderSchema = z.object({
  id: z.number().int(),
  /** Отображаемый номер заказа; у стандартного Woo совпадает с id. */
  number: z.union([z.string(), z.number()]).nullish(),
  status: z.string(),
  currency: z.string().nullish(),
  total: z.string().nullish(),
  date_paid_gmt: z.string().nullish(),
  transaction_id: z.string().nullish(),
  billing: z.object({ email: z.string().nullish() }).nullish(),
  line_items: z.array(lineItemSchema).default([]),
});

export type WooOrder = z.infer<typeof wooOrderSchema>;

/** Пинг при создании вебхука: `{"webhook_id": 12}` — отвечаем 200 и ничего не делаем. */
export const wooPingSchema = z.object({ webhook_id: z.union([z.number(), z.string()]) });

/**
 * Статусы, при которых доступ открывается. `processing` — деньги списаны, заказ
 * в работе; `completed` — заказ закрыт. Для виртуальных товаров Woo обычно ставит
 * сразу `completed`, но на некоторых конфигурациях — `processing`, поэтому оба.
 */
export const PAID_STATUSES = ["processing", "completed"] as const;

/** Статусы, при которых доступ отзывается: деньги вернулись или заказ отменён. */
export const REVOKED_STATUSES = ["refunded", "cancelled"] as const;

export type WooOutcome = "paid" | "revoked" | "ignore";

export function outcomeOf(status: string): WooOutcome {
  const s = status.trim().toLowerCase().replace(/^wc-/, "");
  if ((PAID_STATUSES as readonly string[]).includes(s)) return "paid";
  if ((REVOKED_STATUSES as readonly string[]).includes(s)) return "revoked";
  return "ignore";
}

/** Номер заказа для человека: то, что покупатель видит в письме магазина. */
export function orderNumber(order: WooOrder): string {
  return String(order.number ?? order.id);
}

/** E-mail плательщика в нижнем регистре — единственные ПДн, которые мы берём. */
export function payerEmail(order: WooOrder): string | null {
  const email = order.billing?.email?.trim().toLowerCase();
  return email ? email : null;
}

/**
 * Сумма позиции в копейках. Woo отдаёт деньги строкой («350.00»), Number()
 * на ней безопасен, но копейки считаем через округление, чтобы 0.1+0.2 не
 * превратились в 30.000000000000004.
 */
export function toTiyn(amount: string | null | undefined): number {
  const value = Number(amount ?? 0);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

export interface WooPurchasedItem {
  productId: number;
  sku: string | null;
  quantity: number;
  totalTiyn: number;
}

/** Позиции заказа в удобном виде; позиции с нулевым количеством отбрасываем. */
export function purchasedItems(order: WooOrder): WooPurchasedItem[] {
  return order.line_items
    .map((i) => ({
      productId: i.product_id,
      sku: i.sku?.trim() || null,
      quantity: i.quantity ?? 1,
      totalTiyn: toTiyn(i.total),
    }))
    .filter((i) => i.quantity > 0);
}

/**
 * Ключ идемпотентности для WebhookEvent. Магазин повторяет доставку при ошибке,
 * а статус заказа меняется несколько раз (processing → completed) — поэтому в
 * ключ входит и статус: повтор того же события отсеивается, а смена статуса
 * обрабатывается как новое.
 */
export function wooEventId(order: WooOrder, status: string): string {
  return `order:${order.id}:${status.trim().toLowerCase().replace(/^wc-/, "")}`;
}
