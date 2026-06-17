import { db } from "@/lib/db";
import { levelForXp } from "./levels.js";
import { applyStreak } from "./streak.js";

/**
 * Начисление наград (S8). Идемпотентно по смыслу: бейдж выдаётся один раз,
 * XP суммируется. Вызывается из потоков обучения (урок/тест/сертификат).
 * Ошибки геймификации не должны ронять основной поток — оборачивать в try/catch.
 */

/** Начислить XP и пересчитать уровень. Возвращает признак повышения уровня. */
export async function awardXp(
  userId: string,
  amount: number,
): Promise<{ xp: number; level: number; leveledUp: boolean }> {
  const existing = await db.gamificationProfile.findUnique({
    where: { userId },
    select: { xp: true, level: true },
  });
  const prevLevel = existing?.level ?? 1;
  const xp = (existing?.xp ?? 0) + amount;
  const level = levelForXp(xp);

  await db.gamificationProfile.upsert({
    where: { userId },
    create: { userId, xp, level },
    update: { xp, level },
  });

  return { xp, level, leveledUp: level > prevLevel };
}

/** Выдать бейдж по коду, если ещё не выдан. Возвращает true, если выдан впервые. */
export async function awardBadge(userId: string, code: string): Promise<boolean> {
  const badge = await db.badge.findUnique({ where: { code }, select: { id: true } });
  if (!badge) return false;

  const existing = await db.userBadge.findUnique({
    where: { userId_badgeId: { userId, badgeId: badge.id } },
    select: { userId: true },
  });
  if (existing) return false;

  await db.userBadge.create({ data: { userId, badgeId: badge.id } });
  return true;
}

/** Обновить серию активности (streak) на сегодня. */
export async function touchStreak(userId: string, today: Date = new Date()): Promise<number> {
  const profile = await db.gamificationProfile.findUnique({
    where: { userId },
    select: { streakDays: true, lastActiveOn: true, streakFreezes: true },
  });
  const result = applyStreak(
    profile?.lastActiveOn ?? null,
    today,
    profile?.streakDays ?? 0,
    profile?.streakFreezes ?? 0,
  );

  await db.gamificationProfile.upsert({
    where: { userId },
    create: { userId, streakDays: result.streak, streakFreezes: result.freezes, lastActiveOn: today },
    update: { streakDays: result.streak, streakFreezes: result.freezes, lastActiveOn: today },
  });
  return result.streak;
}
