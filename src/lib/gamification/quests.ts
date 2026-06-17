import { db } from "@/lib/db";

/**
 * Ежедневные цели (Daily Quests, как Duolingo): дробные достижимые задачи дня,
 * прогресс считается из доменных таблиц за сегодня (без отдельной системы наград —
 * XP начисляется самими действиями). Чистая сборка quests — юнит-тестируема.
 */

export interface DailyQuestCounts {
  lessons: number; // уроков пройдено сегодня
  reviews: number; // карточек повторено сегодня
  practice: number; // тренировок-диалогов сегодня (симуляции)
}

export interface DailyQuest {
  key: string;
  label: string;
  current: number;
  target: number;
  done: boolean;
}

/** Сборка списка целей с прогрессом и отметкой выполнения. Чистая функция. */
export function buildDailyQuests(counts: DailyQuestCounts): DailyQuest[] {
  const make = (key: string, label: string, current: number, target: number): DailyQuest => ({
    key,
    label,
    current: Math.min(current, target),
    target,
    done: current >= target,
  });
  return [
    make("lesson", "Пройти урок", counts.lessons, 1),
    make("review", "Повторить 5 карточек", counts.reviews, 5),
    make("practice", "Провести тренировку-диалог", counts.practice, 1),
  ];
}

/** Сколько целей выполнено из общего числа. */
export function questsCompleted(quests: DailyQuest[]): { done: number; total: number } {
  return { done: quests.filter((q) => q.done).length, total: quests.length };
}

/** Начало текущих суток по UTC (как в прочих дневных лимитах). */
function startOfDay(now: Date): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Прогресс дневных целей ученика: считает активность из доменных таблиц за сегодня. */
export async function dailyQuests(userId: string, now = new Date()): Promise<DailyQuest[]> {
  const since = startOfDay(now);
  const [lessons, reviews, practice] = await Promise.all([
    db.lessonProgress.count({ where: { userId, completedAt: { gte: since } } }),
    db.cardReview.count({ where: { userId, lastReviewedAt: { gte: since } } }),
    db.simulationRun.count({ where: { userId, finishedAt: { gte: since } } }),
  ]);
  return buildDailyQuests({ lessons, reviews, practice });
}
