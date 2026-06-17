import type { Metadata } from "next";
import { Flame, Trophy, BookCheck, GraduationCap, Award, Medal, Lock, Star, Snowflake } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { levelProgress } from "@/lib/gamification/levels";

export const metadata: Metadata = {
  title: "Достижения",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function AchievementsPage() {
  const session = await requireUser();
  const userId = session.user.id;

  const [profile, allBadges, earned, lessonsDone, passedAttempts, certs] = await Promise.all([
    db.gamificationProfile.findUnique({
      where: { userId },
      select: { xp: true, streakDays: true, streakFreezes: true },
    }),
    db.badge.findMany({ orderBy: { id: "asc" }, select: { code: true, title: true, description: true } }),
    db.userBadge.findMany({
      where: { userId },
      select: { earnedAt: true, badge: { select: { code: true, title: true } } },
    }),
    db.lessonProgress.count({ where: { userId, completedAt: { not: null } } }),
    db.quizAttempt.findMany({
      where: { userId, status: "PASSED" },
      distinct: ["quizId"],
      select: { quizId: true },
    }),
    db.certificate.findMany({
      where: { userId, revokedAt: null },
      orderBy: { issuedAt: "desc" },
      select: { id: true, issuedAt: true, course: { select: { title: true } } },
    }),
  ]);

  const xp = profile?.xp ?? 0;
  const p = levelProgress(xp);
  const earnedByCode = new Map(earned.map((e) => [e.badge.code, e.earnedAt]));

  // Лента активности: бейджи + сертификаты, по дате убыванию.
  const timeline = [
    ...earned.map((e) => ({
      kind: "badge" as const,
      title: `Достижение «${e.badge.title}»`,
      at: e.earnedAt,
    })),
    ...certs.map((c) => ({
      kind: "cert" as const,
      title: `Сертификат: ${c.course.title}`,
      at: c.issuedAt,
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 8);

  const stats = [
    { icon: BookCheck, color: "text-emerald-600", value: lessonsDone, label: "уроков пройдено" },
    { icon: GraduationCap, color: "text-sky-600", value: passedAttempts.length, label: "тестов сдано" },
    { icon: Award, color: "text-amber-600", value: certs.length, label: certs.length === 1 ? "сертификат" : "сертификатов" },
    { icon: Medal, color: "text-violet-600", value: `${earned.length}/${allBadges.length}`, label: "достижений" },
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">Достижения</h1>

      {/* Уровень и XP */}
      <section className="mt-6 rounded-2xl border border-foreground/10 bg-gradient-to-br from-amber-500/[0.08] to-transparent p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-2xl font-bold text-amber-700">
              {p.level}
            </div>
            <div>
              <p className="text-lg font-bold">Уровень {p.level}</p>
              <p className="text-sm text-foreground/55">
                {p.xp} XP · до уровня {p.level + 1} осталось {p.nextLevelAt - p.xp}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {profile?.streakDays ? (
              <div className="flex items-center gap-1.5 rounded-full bg-orange-500/10 px-3 py-1.5 text-sm font-medium text-orange-700">
                <Flame className="size-4" />
                Серия {profile.streakDays} дн.
              </div>
            ) : null}
            {profile?.streakFreezes ? (
              <div
                className="flex items-center gap-1.5 rounded-full bg-sky-500/10 px-3 py-1.5 text-sm font-medium text-sky-700"
                title="Заморозка спасает серию при пропуске дня"
              >
                <Snowflake className="size-4" />
                {profile.streakFreezes}
              </div>
            ) : null}
          </div>
        </div>
        <div
          className="mt-4 h-2.5 overflow-hidden rounded-full bg-foreground/10"
          role="progressbar"
          aria-valuenow={p.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Прогресс до уровня ${p.level + 1}`}
        >
          <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${p.percent}%` }} />
        </div>
      </section>

      {/* Статистика */}
      <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s, i) => (
          <div key={i} className="rounded-2xl border border-foreground/10 bg-background p-4">
            <s.icon className={`size-5 ${s.color}`} />
            <p className="mt-2 text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-foreground/55">{s.label}</p>
          </div>
        ))}
      </section>

      {/* Бейджи */}
      <section className="mt-6">
        <h2 className="flex items-center gap-2 font-semibold">
          <Trophy className="size-4 text-amber-600" />
          Бейджи
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {allBadges.map((b) => {
            const earnedAt = earnedByCode.get(b.code);
            const has = !!earnedAt;
            return (
              <div
                key={b.code}
                className={[
                  "flex items-start gap-3 rounded-2xl border p-4 transition-colors",
                  has ? "border-amber-500/30 bg-amber-500/[0.06]" : "border-foreground/10 bg-foreground/[0.02]",
                ].join(" ")}
              >
                <div
                  className={[
                    "flex size-10 shrink-0 items-center justify-center rounded-full text-lg",
                    has ? "bg-amber-500/15" : "bg-foreground/10",
                  ].join(" ")}
                >
                  {has ? "🏅" : <Lock className="size-4 text-foreground/30" />}
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${has ? "" : "text-foreground/55"}`}>{b.title}</p>
                  <p className="mt-0.5 text-xs text-foreground/50">{b.description}</p>
                  {earnedAt ? (
                    <p className="mt-1 text-[11px] text-amber-700">
                      получен {earnedAt.toLocaleDateString("ru-RU")}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Лента активности */}
      {timeline.length > 0 ? (
        <section className="mt-6">
          <h2 className="flex items-center gap-2 font-semibold">
            <Star className="size-4 text-amber-600" />
            Недавние достижения
          </h2>
          <ol className="mt-3 space-y-2">
            {timeline.map((t, i) => (
              <li
                key={i}
                className="flex items-center gap-3 rounded-xl border border-foreground/10 bg-background p-3 text-sm"
              >
                <span
                  className={[
                    "flex size-8 shrink-0 items-center justify-center rounded-full",
                    t.kind === "cert" ? "bg-amber-500/15 text-amber-600" : "bg-violet-500/15 text-violet-600",
                  ].join(" ")}
                >
                  {t.kind === "cert" ? <Award className="size-4" /> : <Medal className="size-4" />}
                </span>
                <span className="min-w-0 flex-1 truncate">{t.title}</span>
                <span className="shrink-0 text-xs text-foreground/45">{t.at.toLocaleDateString("ru-RU")}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </main>
  );
}
