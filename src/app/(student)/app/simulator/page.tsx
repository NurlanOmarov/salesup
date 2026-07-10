import type { Metadata } from "next";
import Link from "next/link";
import { MessagesSquare, TrendingUp, Trophy, CheckCircle2, Target } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { listSimulationRuns, simulationStats } from "@/lib/learn/simulations";

export const metadata: Metadata = {
  title: "Тренировки звонков",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function SimulatorPage() {
  const session = await requireUser();
  const userId = session.user.id;
  const [stats, runs] = await Promise.all([
    simulationStats(userId),
    listSimulationRuns(userId),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center gap-2">
        <MessagesSquare className="size-6 text-amber-600" />
        <h1 className="text-2xl font-bold">Тренировки звонков</h1>
      </div>
      <p className="mt-1 text-sm text-foreground/60">
        История диалогов с AI-клиентом и динамика навыка. Запускайте симулятор на вкладке урока.
      </p>

      {stats.total === 0 ? (
        <div className="mt-10 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-10 text-center">
          <Target className="mx-auto size-10 text-foreground/30" />
          <p className="mt-3 font-medium">Тренировок пока нет</p>
          <p className="mt-1 text-sm text-foreground/60">
            Откройте урок с симулятором и проведите первый тренировочный звонок — здесь появится ваш прогресс.
          </p>
        </div>
      ) : (
        <>
          {/* Сводка */}
          <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat icon={MessagesSquare} color="text-sky-600" value={stats.total} label="тренировок" />
            <Stat icon={TrendingUp} color="text-emerald-600" value={`${stats.avgScore}%`} label="средний балл" />
            <Stat icon={Trophy} color="text-amber-600" value={`${stats.bestScore}%`} label="лучший балл" />
            <Stat icon={CheckCircle2} color="text-violet-600" value={stats.passedCount} label="зачтено" />
          </section>

          {/* Динамика */}
          {stats.trend.length >= 2 ? (
            <section className="mt-5 rounded-2xl border border-foreground/10 bg-background p-5">
              <h2 className="text-sm font-semibold">Динамика последних тренировок</h2>
              <div className="mt-4 flex items-end gap-1.5" style={{ height: 96 }}>
                {stats.trend.map((score, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
                    <div
                      className={`w-full rounded-t ${score >= 80 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-red-400"}`}
                      style={{ height: `${Math.max(4, score)}%` }}
                      title={`${score}%`}
                    />
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-foreground/45">Высота столбца — итоговый балл тренировки.</p>
            </section>
          ) : null}

          {/* Список тренировок */}
          <section className="mt-6">
            <h2 className="font-semibold">Все тренировки</h2>
            <ul className="mt-3 space-y-2">
              {runs.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-3 rounded-2xl border border-foreground/10 bg-background p-4"
                >
                  <span
                    className={[
                      "flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold",
                      r.scorePct >= 80
                        ? "bg-emerald-500/15 text-emerald-700"
                        : r.scorePct >= 50
                          ? "bg-amber-500/15 text-amber-700"
                          : "bg-red-500/15 text-red-700",
                    ].join(" ")}
                  >
                    {r.scorePct}%
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/app/learn/${r.courseSlug}/${r.lessonId}`}
                      className="truncate font-medium hover:text-amber-700"
                    >
                      {r.scenarioTitle}
                    </Link>
                    <p className="truncate text-xs text-foreground/50">{r.lessonTitle}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    {r.passed != null ? (
                      <span
                        className={`text-xs font-medium ${r.passed ? "text-emerald-700" : "text-red-700"}`}
                      >
                        {r.passed ? "зачтено" : "не зачтено"}
                      </span>
                    ) : null}
                    <p className="text-xs text-foreground/45">
                      {new Date(r.createdAt).toLocaleDateString("ru-RU")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}

function Stat({
  icon: Icon,
  color,
  value,
  label,
}: {
  icon: typeof MessagesSquare;
  color: string;
  value: string | number;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-foreground/10 bg-background p-4">
      <Icon className={`size-5 ${color}`} />
      <p className="mt-2 text-2xl font-bold">{value}</p>
      <p className="text-xs text-foreground/55">{label}</p>
    </div>
  );
}
