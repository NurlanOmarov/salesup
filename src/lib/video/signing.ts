import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Подпись URL медиа-сегментов (CLAUDE.md, правило 2): сегмент отдаётся только
 * по ссылке, подписанной HMAC(userId + key + exp) на VIDEO_SIGNING_SECRET.
 * Подпись привязана к пользователю (чужой не воспроизведёт) и к сроку (exp ≤ 4 ч),
 * поэтому утёкшая ссылка протухает и не работает в другой сессии.
 *
 * Чистый модуль (без БД/сети) — полностью юнит-тестируемый.
 */

export const SEGMENT_TTL_SEC = 4 * 60 * 60; // 4 часа (потолок по ТЗ)

/** Каноническая строка для подписи: фиксированный порядок и разделитель. */
function payload(userId: string, key: string, expSec: number): string {
  return `${userId}\n${key}\n${expSec}`;
}

/** HMAC-SHA256 в hex. */
export function signSegment(
  userId: string,
  key: string,
  expSec: number,
  secret: string,
): string {
  return createHmac("sha256", secret).update(payload(userId, key, expSec)).digest("hex");
}

/**
 * Проверить подпись и срок. Возвращает причину отказа или null при успехе.
 * Сравнение подписи — constant-time, чтобы не утекало по таймингу.
 */
export function verifySegment(input: {
  userId: string;
  key: string;
  expSec: number;
  sig: string;
  secret: string;
  nowSec: number;
}): null | "EXPIRED" | "BAD_SIGNATURE" {
  const { userId, key, expSec, sig, secret, nowSec } = input;
  const expected = signSegment(userId, key, expSec, secret);

  // Сначала подпись (constant-time), затем срок — чтобы протухший, но валидно
  // подписанный, и подделанный давали одинаковый профиль по времени до проверки срока.
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return "BAD_SIGNATURE";
  if (nowSec > expSec) return "EXPIRED";
  return null;
}

/** Срок истечения для новой подписи (сейчас + TTL), в секундах. */
export function segmentExpiry(nowSec: number, ttlSec: number = SEGMENT_TTL_SEC): number {
  return nowSec + ttlSec;
}
