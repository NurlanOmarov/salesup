import { NextResponse } from "next/server";
import { env } from "@/env";
import { log } from "@/lib/log";
import { handleEvent, verifySignature } from "@/lib/live/webhook";

/**
 * Приём событий SABAK: старт и конец встречи, готовность записи, посещаемость
 * (docs/S2S_API.md §4). Без этого маршрута итоги приходилось бы забирать
 * кнопкой в консоли — то есть вручную, чего платформа не делает.
 *
 * Тело читаем строкой: подпись считается по сырым байтам, до JSON-разбора.
 */
export async function POST(req: Request) {
  if (!env.SABAK_WEBHOOK_SECRET) {
    // Без секрета проверить отправителя нечем, а верить непроверенным событиям
    // об изменении статусов встреч нельзя.
    return new NextResponse("Приём вебхуков не настроен", { status: 503 });
  }

  const rawBody = await req.text();
  const headers = {
    event: req.headers.get("x-sabak-event"),
    delivery: req.headers.get("x-sabak-delivery"),
    timestamp: req.headers.get("x-sabak-timestamp"),
    signature: req.headers.get("x-sabak-signature"),
  };

  const verified = verifySignature(rawBody, headers, env.SABAK_WEBHOOK_SECRET);
  if (!verified.ok) {
    log.warn({ reason: verified.reason, event: headers.event }, "live.webhook: отклонён");
    return new NextResponse("Подпись не подтверждена", { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody) as { id?: string; event?: string };
    await handleEvent(headers.delivery!, payload);
  } catch (e) {
    log.error({ err: e, event: headers.event }, "live.webhook: обработка не удалась");
    // 5xx — сигнал отправителю повторить: событие важное, а ретраи у SABAK есть.
    return new NextResponse("Не удалось обработать", { status: 500 });
  }

  // Повтор доставки тоже 2xx: для отправителя это успех, иначе он будет
  // ретраить до исчерпания попыток из-за уже обработанного события.
  return NextResponse.json({ ok: true });
}
