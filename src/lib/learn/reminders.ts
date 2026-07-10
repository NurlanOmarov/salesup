import { db } from "@/lib/db";
import { enqueue } from "@/lib/jobs/enqueue";
import { dueCount } from "@/lib/learn/review";

/**
 * Ежедневные учебные напоминания (zero-touch): ставим в очередь письма ученикам,
 * у которых есть карточки к повторению или серия под угрозой (учились вчера, но не
 * сегодня). Никакой ручной работы — фактическая отправка идёт через email.send и
 * включается флагом EMAIL_ENABLED. ПДн (e-mail) не логируем (CLAUDE.md, правило 9).
 */

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

export interface ReminderResult {
  candidates: number;
  enqueued: number;
}

/** id активных учеников (есть хотя бы один не истёкший/не отозванный доступ). */
async function activeStudentIds(now: Date): Promise<string[]> {
  const enrollments = await db.enrollment.findMany({
    where: {
      revokedAt: null,
      startsAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      user: { role: "STUDENT", deletedAt: null },
    },
    select: { userId: true },
    distinct: ["userId"],
  });
  return enrollments.map((e) => e.userId);
}

export async function buildDailyReminders(now = new Date()): Promise<ReminderResult> {
  const userIds = await activeStudentIds(now);
  let enqueued = 0;

  for (const userId of userIds) {
    const [user, profile, due] = await Promise.all([
      db.user.findUnique({ where: { id: userId }, select: { email: true, name: true } }),
      db.gamificationProfile.findUnique({
        where: { userId },
        select: { streakDays: true, lastActiveOn: true },
      }),
      dueCount(userId, now),
    ]);
    if (!user?.email) continue;

    const studiedToday = profile?.lastActiveOn ? isSameDay(profile.lastActiveOn, now) : false;
    const streakAtRisk = !studiedToday && (profile?.streakDays ?? 0) >= 2;

    // Шлём максимум одно письмо в день и только при реальном поводе.
    if (due === 0 && !streakAtRisk) continue;

    const name = user.name ?? "";
    const subject =
      due > 0
        ? `Пора повторить материал — ${due} ${pluralCards(due)}`
        : "Не теряйте свою серию обучения 🔥";
    const text =
      due > 0
        ? `${greeting(name)}Сегодня к повторению ${due} ${pluralCards(due)}. Откройте раздел «Повторение» — это займёт пару минут и закрепит знания.`
        : `${greeting(name)}Вы учились ${profile?.streakDays} ${pluralDays(profile?.streakDays ?? 0)} подряд. Пройдите хотя бы один урок сегодня, чтобы не потерять серию.`;

    await enqueue("email.send", {
      to: user.email,
      subject,
      text,
      kind: "study-reminder",
    });
    enqueued++;
  }

  return { candidates: userIds.length, enqueued };
}

function greeting(name: string): string {
  return name ? `${name}, ` : "";
}

function pluralCards(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "карточка";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "карточки";
  return "карточек";
}

function pluralDays(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "дня";
  return "дней";
}
