/**
 * Подсчёт очков для тренажёра «возражения на скорость» (rapid-fire). Чистые
 * функции, без БД/таймеров — юнит-тестируемы. Тренажёр клиентский, без записи на
 * сервер: быстрый ответ под таймером тренирует «мышцу возражений».
 */

export const RAPID_QUESTION_MS = 8000; // время на одно возражение
export const RAPID_BASE_POINTS = 100; // база за верный ответ

/** Множитель за серию верных ответов подряд (включая текущий). */
export function comboMultiplier(streak: number): number {
  if (streak >= 6) return 3;
  if (streak >= 4) return 2;
  if (streak >= 2) return 1.5;
  return 1;
}

/**
 * Очки за ответ: 0 при ошибке/таймауте; иначе база + бонус за скорость
 * (доля оставшегося времени), всё умножается на комбо-множитель серии.
 * @param streak длина серии верных ответов ПОСЛЕ учёта текущего (1 — первый верный)
 */
export function scoreAnswer(correct: boolean, timeLeftMs: number, streak: number): number {
  if (!correct) return 0;
  const ratio = Math.max(0, Math.min(1, timeLeftMs / RAPID_QUESTION_MS));
  const timeBonus = Math.round(ratio * RAPID_BASE_POINTS); // 0..100
  return Math.round((RAPID_BASE_POINTS + timeBonus) * comboMultiplier(streak));
}
