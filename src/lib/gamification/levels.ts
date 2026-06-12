/**
 * Уровни по XP (S8, сдержанная геймификация). Чистые функции — юнит-тестируемы.
 * Пороги растут плавно: чем выше уровень, тем больше XP до следующего. XP —
 * фоновый показатель прогресса, не «казино»: без поп-апов на каждый клик.
 */

/** Кумулятивный XP, необходимый, чтобы достичь уровня L (L≥1). L1 = 0. */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return 50 * (level - 1) * level; // L2=100, L3=300, L4=600, L5=1000, L6=1500…
}

/** Текущий уровень по накопленному XP. */
export function levelForXp(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
}

export interface LevelProgress {
  level: number;
  xp: number;
  levelFloor: number; // XP начала текущего уровня
  nextLevelAt: number; // XP начала следующего уровня
  intoLevel: number; // сколько XP набрано внутри уровня
  span: number; // сколько XP нужно на весь уровень
  percent: number; // 0–100 прогресс до следующего уровня
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelForXp(xp);
  const levelFloor = xpForLevel(level);
  const nextLevelAt = xpForLevel(level + 1);
  const span = Math.max(1, nextLevelAt - levelFloor);
  const intoLevel = xp - levelFloor;
  return {
    level,
    xp,
    levelFloor,
    nextLevelAt,
    intoLevel,
    span,
    percent: Math.min(100, Math.floor((intoLevel / span) * 100)),
  };
}

/** XP за действия (сдержанно — за реальные достижения, не за клики). */
export const XP_REWARDS = {
  lessonCompleted: 20,
  quizPassed: 30,
  examPassed: 80,
  certificate: 100,
} as const;
