import { NextResponse } from "next/server";
import { env } from "@/env";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { verifyWooSignature } from "@/lib/payments/woo/signature";
import { fulfillWooOrder } from "@/lib/payments/woo/fulfill";
import { wooEventId, wooOrderSchema, wooPingSchema } from "@/lib/payments/woo/order";

/**
 * Приём уведомлений магазина WooCommerce с activesales.by (docs/WOO-INTEGRATION.md).
 *
 * Карту принимает эквайринг Альфа-Банка на белорусской площадке; сюда приходит
 * только факт оплаты заказа, поэтому карточных данных в запросе нет и быть не может.
 *
 * Подлинность запроса проверяется подписью тела (HMAC-SHA256 общим секретом).
 * Повторные доставки отсекает WebhookEvent с @@unique([provider, providerEventId]) —
 * магазин повторяет уведомление при любом ответе, отличном от 200 (CLAUDE.md, правило 8).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROVIDER = "woocommerce";

export async function POST(request: Request): Promise<NextResponse> {
  const secret = env.WOO_WEBHOOK_SECRET;
  if (!secret) {
    log.warn("woo webhook: WOO_WEBHOOK_SECRET не задан — приём выключен");
    return NextResponse.json({ error: "payments disabled" }, { status: 503 });
  }

  // Сырое тело: подпись считается по нему до всякого разбора.
  const raw = await request.text();
  if (!verifyWooSignature(raw, request.headers.get("x-wc-webhook-signature"), secret)) {
    log.warn(
      { topic: request.headers.get("x-wc-webhook-topic") },
      "woo webhook: неверная подпись — запрос отклонён",
    );
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  // Пинг при создании вебхука в WP-админке: подтверждаем доставку и выходим.
  if (wooPingSchema.safeParse(payload).success) {
    return NextResponse.json({ ok: true, ping: true });
  }

  const parsed = wooOrderSchema.safeParse(payload);
  if (!parsed.success) {
    log.warn({ topic: request.headers.get("x-wc-webhook-topic") }, "woo webhook: неизвестный формат");
    // 200 — иначе магазин будет ретраить то, что мы всё равно не поймём.
    return NextResponse.json({ ok: true, ignored: true });
  }

  const order = parsed.data;
  const eventId = wooEventId(order, order.status);

  // Заявка на обработку: конфликт по unique означает, что событие уже приходило.
  // Но «приходило» ≠ «обработано»: если прошлая попытка упала, магазин повторяет
  // доставку — и мы обязаны отработать её заново, иначе оплата останется без доступа.
  try {
    await db.webhookEvent.create({
      data: {
        provider: PROVIDER,
        providerEventId: eventId,
        // Payload храним для разбора спорных случаев; карточных данных в нём нет,
        // из ПДн — e-mail плательщика (он и так в Order.email).
        payload: order as unknown as object,
      },
    });
  } catch {
    const seen = await db.webhookEvent.findUnique({
      where: { provider_providerEventId: { provider: PROVIDER, providerEventId: eventId } },
      select: { processedAt: true },
    });
    if (seen?.processedAt) {
      log.info({ eventId }, "woo webhook: событие уже обработано, повтор пропущен");
      return NextResponse.json({ ok: true, duplicate: true });
    }
    log.info({ eventId }, "woo webhook: повтор после неудачной попытки — обрабатываем снова");
  }

  try {
    const result = await fulfillWooOrder(order);
    await db.webhookEvent.update({
      where: { provider_providerEventId: { provider: PROVIDER, providerEventId: eventId } },
      data: { processedAt: new Date() },
    });
    return NextResponse.json({ ok: true, result: result.kind });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.webhookEvent.update({
      where: { provider_providerEventId: { provider: PROVIDER, providerEventId: eventId } },
      data: { error: message.slice(0, 500) },
    });
    log.error({ eventId, error: message }, "woo webhook: обработка не удалась");
    // 500 → магазин повторит доставку (3 попытки), а событие уже помечено ошибкой.
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
