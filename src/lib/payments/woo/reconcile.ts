import { env } from "@/env";
import { log } from "@/lib/log";
import { db } from "@/lib/db";
import { fulfillWooOrder } from "./fulfill";
import { wooEventId, wooOrderSchema, type WooOrder } from "./order";

/**
 * Сверка с магазином (docs/WOO-INTEGRATION.md).
 *
 * Webhook может не дойти: магазин делает три попытки и сдаётся, а человек уже
 * заплатил. Раз в сутки забираем оплаченные заказы за последние дни через Woo
 * REST API (ключ с правами «Чтение») и до-обрабатываем те, которых у нас нет.
 *
 * Обработка идёт через тот же fulfillWooOrder и тот же WebhookEvent, поэтому
 * заказ, уже закрытый вебхуком, повторно доступ не выдаёт.
 */

const PROVIDER = "woocommerce";
/** Глубина сверки: недели с запасом хватает — вебхук отваливается редко и ненадолго. */
const LOOKBACK_DAYS = 7;

export function wooApiConfigured(): boolean {
  return Boolean(env.WOO_CONSUMER_KEY && env.WOO_CONSUMER_SECRET);
}

/** Заказы магазина в статусах «оплачен» за последние дни. */
async function fetchPaidOrders(since: Date): Promise<WooOrder[]> {
  const url = new URL("/wp-json/wc/v3/orders", env.WOO_STORE_URL);
  url.searchParams.set("status", "processing,completed");
  url.searchParams.set("after", since.toISOString());
  url.searchParams.set("per_page", "100");

  // Basic-авторизация ключами REST API — стандартный способ Woo для HTTPS.
  const auth = Buffer.from(`${env.WOO_CONSUMER_KEY}:${env.WOO_CONSUMER_SECRET}`).toString("base64");
  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(`woo REST ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  }

  const body: unknown = await res.json();
  if (!Array.isArray(body)) throw new Error("woo REST: ожидался массив заказов");

  return body.flatMap((raw) => {
    const parsed = wooOrderSchema.safeParse(raw);
    return parsed.success ? [parsed.data] : [];
  });
}

export interface ReconcileResult {
  checked: number;
  recovered: number;
}

export async function reconcileWooOrders(): Promise<ReconcileResult> {
  if (!wooApiConfigured()) {
    log.info("woo reconcile пропущен: ключи REST API не заданы");
    return { checked: 0, recovered: 0 };
  }

  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const orders = await fetchPaidOrders(since);
  let recovered = 0;

  for (const order of orders) {
    const eventId = wooEventId(order, order.status);
    const seen = await db.webhookEvent.findUnique({
      where: { provider_providerEventId: { provider: PROVIDER, providerEventId: eventId } },
      select: { processedAt: true },
    });
    if (seen?.processedAt) continue;

    try {
      const result = await fulfillWooOrder(order);
      await db.webhookEvent.upsert({
        where: { provider_providerEventId: { provider: PROVIDER, providerEventId: eventId } },
        create: {
          provider: PROVIDER,
          providerEventId: eventId,
          payload: order as unknown as object,
          processedAt: new Date(),
        },
        update: { processedAt: new Date(), error: null },
      });
      if (result.kind === "granted") recovered += 1;
    } catch (error) {
      log.error({ eventId, err: error }, "woo reconcile: заказ не удалось обработать");
    }
  }

  log.info({ checked: orders.length, recovered }, "woo reconcile завершён");
  return { checked: orders.length, recovered };
}
