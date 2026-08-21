import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { log } from "@/lib/log";

/**
 * Приём исходящих вебхуков SABAK (docs/S2S_API.md §4).
 *
 * Подпись считается по СЫРОМУ телу до разбора JSON: `JSON.parse` + `stringify`
 * меняют пробелы и порядок ключей, и подпись перестала бы сходиться. Поэтому
 * маршрут читает `req.text()` и передаёт строку сюда.
 *
 * Три защиты, и все три обязательны:
 *   1. HMAC-SHA256 от `<timestamp>.<тело>` — подтверждает отправителя;
 *   2. окно 5 минут по timestamp — не даёт переиграть перехваченный запрос;
 *   3. дедупликация по `X-Sabak-Delivery` — доставка «хотя бы один раз», и один
 *      и тот же `recording.ready` придёт повторно при любой сетевой заминке.
 */

export const SABAK_PROVIDER = "sabak";

export interface WebhookHeaders {
  event: string | null;
  delivery: string | null;
  timestamp: string | null;
  signature: string | null;
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "no_secret" | "missing_headers" | "stale" | "bad_signature" };

/** Проверка подписи и свежести. Секрет — `SABAK_WEBHOOK_SECRET`. */
export function verifySignature(
  rawBody: string,
  headers: WebhookHeaders,
  secret: string | undefined,
  now: Date = new Date(),
): VerifyResult {
  if (!secret) return { ok: false, reason: "no_secret" };
  if (!headers.timestamp || !headers.signature || !headers.delivery) {
    return { ok: false, reason: "missing_headers" };
  }

  const ts = Number(headers.timestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: "missing_headers" };
  const skewSec = Math.abs(Math.floor(now.getTime() / 1000) - ts);
  if (skewSec > 300) return { ok: false, reason: "stale" };

  const expected = createHmac("sha256", secret)
    .update(`${ts}.${rawBody}`)
    .digest("hex");
  const received = headers.signature.trim().toLowerCase();

  // Сравнение постоянного времени: обычное === утекает длину совпавшего
  // префикса и позволяет подобрать подпись побайтно.
  if (expected.length !== received.length) return { ok: false, reason: "bad_signature" };
  const same = timingSafeEqual(Buffer.from(expected), Buffer.from(received));
  return same ? { ok: true } : { ok: false, reason: "bad_signature" };
}

interface Payload {
  id?: string;
  event?: string;
  data?: Record<string, unknown>;
}

/**
 * Обработка события. Возвращает `false`, если событие уже обрабатывалось —
 * маршрут всё равно отвечает 2xx: для отправителя повтор должен выглядеть
 * успехом, иначе он будет ретраить до исчерпания попыток.
 */
export async function handleEvent(
  delivery: string,
  payload: Payload,
): Promise<{ processed: boolean }> {
  // Уникальность (provider, providerEventId) — та же защита от повторов, что и
  // у платёжных вебхуков (CLAUDE.md, правило 8).
  try {
    await db.webhookEvent.create({
      data: {
        provider: SABAK_PROVIDER,
        providerEventId: delivery,
        payload: payload as object,
      },
    });
  } catch {
    return { processed: false };
  }

  const event = payload.event ?? "";
  const data = payload.data ?? {};
  const lessonId = typeof data.lessonId === "string" ? data.lessonId : null;
  if (!lessonId) {
    await markProcessed(delivery, "нет lessonId");
    return { processed: true };
  }

  const session = await db.liveSession.findUnique({
    where: { sabakLessonId: lessonId },
    select: { id: true },
  });
  if (!session) {
    // Встреча могла быть создана не нами (другой ключ, ручной урок тренера) —
    // это не ошибка, просто нам нечего обновлять.
    await markProcessed(delivery, "встреча не наша");
    return { processed: true };
  }

  switch (event) {
    case "lesson.started":
      await db.liveSession.update({
        where: { id: session.id },
        data: { status: "LIVE" },
      });
      break;

    case "lesson.finished":
      await db.liveSession.update({
        where: { id: session.id },
        data: { status: "FINISHED" },
      });
      break;

    case "recording.ready": {
      const recordingId = typeof data.recordingId === "string" ? data.recordingId : null;
      if (recordingId) {
        await db.liveSession.update({
          where: { id: session.id },
          data: { recordingId, recordingReady: true },
        });
      }
      break;
    }

    case "attendance.ready": {
      const list = Array.isArray(data.participants) ? data.participants : [];
      const participants = list
        .map((p) => p as { externalId?: unknown; attended?: unknown })
        .filter((p) => typeof p.externalId === "string")
        .map((p) => ({
          memberLogin: p.externalId as string,
          attended: p.attended === true,
        }));

      // Сохраняем только факт присутствия: минут в событии нет, и хорошо —
      // отчёт компании ограничен «был / не был» (решение владельца).
      await db.$transaction([
        ...participants.map((p) =>
          db.liveSessionAttendance.upsert({
            where: {
              sessionId_memberLogin: {
                sessionId: session.id,
                memberLogin: p.memberLogin,
              },
            },
            create: {
              sessionId: session.id,
              memberLogin: p.memberLogin,
              attended: p.attended,
            },
            update: { attended: p.attended },
          }),
        ),
        db.liveSession.update({
          where: { id: session.id },
          data: {
            status: "FINISHED",
            attendedCount: participants.filter((p) => p.attended).length,
          },
        }),
      ]);
      break;
    }

    default:
      log.warn({ event }, "live.webhook: неизвестное событие SABAK");
  }

  await markProcessed(delivery);
  return { processed: true };
}

async function markProcessed(delivery: string, note?: string): Promise<void> {
  await db.webhookEvent.updateMany({
    where: { provider: SABAK_PROVIDER, providerEventId: delivery },
    data: { processedAt: new Date(), error: note ?? null },
  });
}
