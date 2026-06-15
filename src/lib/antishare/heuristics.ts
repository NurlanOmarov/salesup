import { createHash } from "node:crypto";

/**
 * Антишаринг (S6.1): защита платного контента от раздачи одного аккаунта.
 * Чистые функции — юнит-тестируемы. Жёстко вход не блокируем (JWT-сессии
 * stateless), а помечаем подозрительное для владельца в /admin/flags + даём
 * ручную заморозку. Немедленный отзыв доступа — через Enrollment.revokedAt.
 */

/** Лимит одновременных устройств на аккаунт (мягкий — выше флагуем). */
export const DEVICE_LIMIT = 2;

/** Грубый отпечаток устройства из User-Agent (браузер+ОС). Не ПДн. */
export function deviceFingerprint(userAgent: string): string {
  // Берём стабильную часть UA, отбрасывая версии-«шум».
  const normalized = userAgent
    .toLowerCase()
    .replace(/\d+(\.\d+)+/g, "") // версии
    .replace(/\s+/g, " ")
    .trim();
  return createHash("sha256").update(normalized || "unknown").digest("hex").slice(0, 32);
}

/** Превышен ли лимит активных устройств. */
export function tooManyDevices(activeCount: number, limit: number = DEVICE_LIMIT): boolean {
  return activeCount > limit;
}

/**
 * Эффективный лимит устройств из настройки ученика (User.deviceLimit):
 *   null → стандартный лимит (DEVICE_LIMIT); 0 → безлимит (возвращаем null); N>0 → N.
 * null на выходе означает «без ограничения» (не флагуем и не блокируем по устройствам).
 */
export function effectiveDeviceLimit(deviceLimit: number | null | undefined): number | null {
  if (deviceLimit === null || deviceLimit === undefined) return DEVICE_LIMIT;
  if (deviceLimit <= 0) return null; // безлимит
  return deviceLimit;
}

/**
 * Аномально много просмотра: суммарно просмотрено заметно больше, чем длится
 * урок (признак параллельного просмотра с нескольких устройств/аккаунт-шеринга).
 * Возвращает true, если watchedSec > factor × durationSec (при известной длительности).
 */
export function suspiciousWatch(watchedSec: number, durationSec: number, factor = 3): boolean {
  if (durationSec <= 0) return false;
  return watchedSec > durationSec * factor;
}

/** Много разных городов за короткое окно (одновременный доступ из разных мест). */
export function tooManyCities(distinctCities: number, maxCities = 2): boolean {
  return distinctCities > maxCities;
}

export type FlagReason = "MANY_DEVICES" | "ABNORMAL_WATCH" | "MANY_CITIES";

/** Свести сигналы в список причин для флага (для /admin/flags). */
export function evaluateFlags(input: {
  activeDevices: number;
  maxWatchedSec: number;
  maxLessonDurationSec: number;
  distinctCities: number;
  deviceLimit?: number | null; // эффективный лимит (null = безлимит → не флагуем по устройствам)
}): FlagReason[] {
  const reasons: FlagReason[] = [];
  const limit = input.deviceLimit === undefined ? DEVICE_LIMIT : input.deviceLimit;
  if (limit !== null && tooManyDevices(input.activeDevices, limit)) reasons.push("MANY_DEVICES");
  if (suspiciousWatch(input.maxWatchedSec, input.maxLessonDurationSec)) reasons.push("ABNORMAL_WATCH");
  if (tooManyCities(input.distinctCities)) reasons.push("MANY_CITIES");
  return reasons;
}
