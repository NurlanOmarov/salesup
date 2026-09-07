import { NextResponse } from "next/server";
import { env } from "@/env";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { verifyAlfaChecksum } from "@/lib/payments/alfa/checksum";
import { fulfillAlfaCallback } from "@/lib/payments/alfa/fulfill";
import {
  alfaCallbackSchema,
  alfaEventId,
  paramsFromBody,
  paramsFromSearch,
} from "@/lib/payments/alfa/callback";

/**
 * Приём callback-уведомлений Альфа-Банка об оплате по платёжной ссылке
 * (docs/ALFA-PAYMENT-LINKS.md).
 *
 * Карту принимает страница банка, поэтому карточных данных в запросе нет и быть
 * не может — приходит только факт оплаты. Подлинность подтверждает контрольная
 * сумма (HMAC-SHA256 общим токеном из личного кабинета).
 *
 * Шлюз шлёт уведомления методом GET или POST — в зависимости от настройки в
 * кабинете, поэтому поддержаны оба. Повторы отсекает WebhookEvent с
 * @@unique([provider, providerEventId]): при ответе, отличном от 200, банк
 * повторяет отправку с интервалом 30 секунд, максимум три раза (правило 8).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROVIDER = "alfa";

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  return handle(paramsFromSearch(url.searchParams));
}

export async function POST(request: Request): Promise<NextResponse> {
  const raw = await request.text();
  // Часть настроек шлёт параметры в теле, часть — всё равно в query: берём оба
  // источника, тело приоритетнее.
  const url = new URL(request.url);
  return handle({ ...paramsFromSearch(url.searchParams), ...paramsFromBody(raw) });
}

async function handle(params: Record<string, string>): Promise<NextResponse> {
  const token = env.ALFA_CALLBACK_TOKEN;
  if (!token) {
    log.warn("alfa callback: ALFA_CALLBACK_TOKEN не задан — приём выключен");
    return NextResponse.json({ error: "payments disabled" }, { status: 503 });
  }

  if (!verifyAlfaChecksum(params, token)) {
    // Имя операции в лог можно: это не ПДн и помогает понять, чей запрос пришёл.
    log.warn({ operation: params.operation }, "alfa callback: неверная контрольная сумма");
    return NextResponse.json({ error: "bad checksum" }, { status: 401 });
  }

  const parsed = alfaCallbackSchema.safeParse(params);
  if (!parsed.success) {
    log.warn("alfa callback: неизвестный формат уведомления");
    // 200 — иначе банк будет повторять то, что мы всё равно не поймём.
    return NextResponse.json({ ok: true, ignored: true });
  }

  const callback = parsed.data;
  const eventId = alfaEventId(callback);

  // Заявка на обработку. Конфликт по unique означает, что событие уже приходило,
  // но «приходило» ≠ «обработано»: если прошлая попытка упала, банк повторяет
  // доставку и мы обязаны отработать её заново — иначе оплата останется без доступа.
  try {
    await db.webhookEvent.create({
      data: {
        provider: PROVIDER,
        providerEventId: eventId,
        // Payload — параметры уведомления: карточных данных в них нет.
        payload: params as unknown as object,
      },
    });
  } catch {
    const seen = await db.webhookEvent.findUnique({
      where: { provider_providerEventId: { provider: PROVIDER, providerEventId: eventId } },
      select: { processedAt: true },
    });
    if (seen?.processedAt) {
      log.info({ eventId }, "alfa callback: событие уже обработано, повтор пропущен");
      return NextResponse.json({ ok: true, duplicate: true });
    }
    log.info({ eventId }, "alfa callback: повтор после неудачной попытки — обрабатываем снова");
  }

  try {
    const result = await fulfillAlfaCallback(callback);
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
    log.error({ eventId, error: message }, "alfa callback: обработка не удалась");
    // 500 → банк повторит доставку, а событие уже помечено ошибкой.
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
