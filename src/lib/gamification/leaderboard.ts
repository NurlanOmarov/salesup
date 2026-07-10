import { db } from "@/lib/db";

/**
 * Анонимный рейтинг по XP: ученику показываем только его позицию («вы в топ N%»),
 * без имён и без списка других — мотивация без соревнования продавцов между собой
 * (дух CLAUDE.md) и без раскрытия ПДн (правило 9). Считается среди учеников с XP > 0.
 */

export interface LeaderboardPosition {
  /** Позиция (1 — лучший). */
  rank: number;
  /** Всего участников рейтинга. */
  total: number;
  /** «Топ N%»: меньше — лучше. */
  topPercent: number;
  /** Доля учеников, которых вы опережаете (0..100). */
  ahead: number;
}

const MIN_PARTICIPANTS = 5; // ниже порога рейтинг не показываем (мало данных / не анонимно)

export async function leaderboardPosition(userId: string): Promise<LeaderboardPosition | null> {
  const me = await db.gamificationProfile.findUnique({
    where: { userId },
    select: { xp: true },
  });
  const myXp = me?.xp ?? 0;
  if (myXp <= 0) return null;

  const [total, better] = await Promise.all([
    db.gamificationProfile.count({ where: { xp: { gt: 0 }, user: { role: "STUDENT", deletedAt: null } } }),
    db.gamificationProfile.count({
      where: { xp: { gt: myXp }, user: { role: "STUDENT", deletedAt: null } },
    }),
  ]);
  if (total < MIN_PARTICIPANTS) return null;

  const rank = better + 1;
  const topPercent = Math.max(1, Math.round((rank / total) * 100));
  const ahead = Math.round(((total - rank) / total) * 100);
  return { rank, total, topPercent, ahead };
}
