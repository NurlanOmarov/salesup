/**
 * Логика серий (streak) — чистая, юнит-тестируема. День активности: продолжаем
 * серию, если прошлый активный день — вчера; сбрасываем, если был раньше; не меняем,
 * если уже сегодня. Даты сравниваются по календарному дню (без времени).
 */

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: Date, b: Date): number {
  const da = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const db = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.round((db - da) / 86_400_000);
}

/** Новое значение серии при активности в день `today`. */
export function nextStreak(
  lastActiveOn: Date | null,
  today: Date,
  currentStreak: number,
): number {
  if (!lastActiveOn) return 1;
  if (dayKey(lastActiveOn) === dayKey(today)) return Math.max(1, currentStreak);
  const gap = daysBetween(lastActiveOn, today);
  if (gap === 1) return currentStreak + 1;
  return 1; // пропуск дня и более — серия сбрасывается
}
