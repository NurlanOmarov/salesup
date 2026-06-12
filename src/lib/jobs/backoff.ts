/**
 * Логика ретраев фоновых задач (S5.4). Чистые функции — юнит-тестируемы.
 * Экспоненциальный backoff с потолком: задача, упавшая на попытке N, повторяется
 * через base·2^(N-1) секунд (1-я неудача → base, 2-я → 2·base, …), не дольше maxSec.
 */

export const BASE_DELAY_SEC = 30;
export const MAX_DELAY_SEC = 30 * 60; // 30 минут

/** Задержка перед следующей попыткой по числу уже выполненных попыток (attempts ≥ 1). */
export function backoffSec(
  attempts: number,
  baseSec: number = BASE_DELAY_SEC,
  maxSec: number = MAX_DELAY_SEC,
): number {
  if (attempts <= 0) return 0;
  const delay = baseSec * 2 ** (attempts - 1);
  return Math.min(delay, maxSec);
}

/** Исчерпаны ли попытки (после неудачной attempts из maxAttempts). */
export function isExhausted(attempts: number, maxAttempts: number): boolean {
  return attempts >= maxAttempts;
}

/** Время следующего запуска после неудачи (now + backoff). */
export function nextRunAfter(now: Date, attempts: number, baseSec?: number, maxSec?: number): Date {
  return new Date(now.getTime() + backoffSec(attempts, baseSec, maxSec) * 1000);
}
