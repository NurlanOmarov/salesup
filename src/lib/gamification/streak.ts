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

/** Максимальный запас заморозок и за сколько дней серии начисляется новая. */
export const MAX_STREAK_FREEZES = 2;
export const FREEZE_EARN_EVERY = 7;

export interface StreakResult {
  streak: number;
  freezes: number;
  usedFreeze: boolean; // заморозка спасла пропущенный день
  earnedFreeze: boolean; // начислена новая заморозка за длину серии
}

/**
 * Серия с «заморозками» (Streak Freeze, как Duolingo): пропуск одного и более дней
 * не обнуляет серию, если хватает заморозок (по одной за пропущенный день). Каждые
 * FREEZE_EARN_EVERY дней серии начисляется заморозка (до максимума). Чистая функция.
 */
export function applyStreak(
  lastActiveOn: Date | null,
  today: Date,
  currentStreak: number,
  freezes: number,
): StreakResult {
  if (!lastActiveOn) return { streak: 1, freezes, usedFreeze: false, earnedFreeze: false };
  if (dayKey(lastActiveOn) === dayKey(today)) {
    return { streak: Math.max(1, currentStreak), freezes, usedFreeze: false, earnedFreeze: false };
  }
  const gap = daysBetween(lastActiveOn, today);

  if (gap === 1) {
    const streak = currentStreak + 1;
    const earnedFreeze = streak % FREEZE_EARN_EVERY === 0 && freezes < MAX_STREAK_FREEZES;
    return { streak, freezes: earnedFreeze ? freezes + 1 : freezes, usedFreeze: false, earnedFreeze };
  }

  // Пропущено gap-1 дней: спасаем серию, если заморозок хватает на каждый пропуск.
  const missed = gap - 1;
  if (missed > 0 && freezes >= missed) {
    return { streak: currentStreak, freezes: freezes - missed, usedFreeze: true, earnedFreeze: false };
  }
  return { streak: 1, freezes, usedFreeze: false, earnedFreeze: false };
}
