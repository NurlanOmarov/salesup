import { createHash } from "node:crypto";

/**
 * Антишаринг (S6.1): защита платного контента от раздачи одного аккаунта.
 * Чистые функции — юнит-тестируемы. Жёстко вход не блокируем (JWT-сессии
 * stateless), а помечаем подозрительное для владельца в /admin/flags + даём
 * ручную заморозку. Немедленный отзыв доступа — через Enrollment.revokedAt.
 */

// Пороги живут в ./limits — их читает и клиентская форма лимита устройств.
export { DEVICE_FLAG_FROM, DEVICE_LIMIT } from "./limits.js";
import { DEVICE_FLAG_FROM, DEVICE_LIMIT } from "./limits.js";

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
 * Лимит устройств для конкретного человека с учётом его организации.
 *
 * Порядок: персональная настройка сильнее настройки клиента, настройка клиента
 * сильнее стандарта платформы. У работников персонального лимита обычно нет —
 * договорённость о числе устройств заключается разом на всю компанию, — но если
 * владелец завёл её отдельному человеку, она и действует.
 *
 * Обе настройки читаются одинаково: null = «наследовать», 0 = безлимит, N = N.
 * На выходе null означает «без ограничения».
 */
export function resolveDeviceLimit(
  userLimit: number | null | undefined,
  orgLimit?: number | null,
): number | null {
  if (userLimit !== null && userLimit !== undefined) return effectiveDeviceLimit(userLimit);
  if (orgLimit !== null && orgLimit !== undefined) return effectiveDeviceLimit(orgLimit);
  return DEVICE_LIMIT;
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
  // Сигнал раньше блокировки: сверх лимита устройств просто не появится (вход не
  // пустит), поэтому флагуем по собственному порогу. «Безлимит» не флагуем —
  // владелец уже решил, что этому аккаунту так можно.
  if (limit !== null && input.activeDevices >= DEVICE_FLAG_FROM) {
    reasons.push("MANY_DEVICES");
  }
  if (suspiciousWatch(input.maxWatchedSec, input.maxLessonDurationSec)) reasons.push("ABNORMAL_WATCH");
  if (tooManyCities(input.distinctCities)) reasons.push("MANY_CITIES");
  return reasons;
}
