import type { Metadata } from "next";
import { AlertTriangle, CheckCircle2, Clock, Headphones, Server } from "lucide-react";
import type { PodcastRunOutcome } from "@prisma/client";
import { db } from "@/lib/db";
import {
  SCHEDULE_LABEL,
  countViews,
  estimateDaysLeft,
  lessonView,
  runnerHealth,
  type LessonPodcastView,
} from "@/lib/factory/podcast-status";

export const metadata: Metadata = {
  title: "Подкасты",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/** Время — по Астане: там стоит мини, и по этим часам идёт расписание. */
const fmt = (d: Date) =>
  d.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Almaty" });

function ago(d: Date, now: Date): string {
  const min = Math.round((now.getTime() - d.getTime()) / 60_000);
  if (min < 1) return "только что";
  if (min < 60) return `${min} мин назад`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} ч назад`;
  return `${Math.round(h / 24)} дн назад`;
}

const VIEW: Record<LessonPodcastView, { label: string; className: string }> = {
  READY: { label: "На сайте", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  GENERATING: { label: "Генерируется", className: "bg-sky-500/10 text-sky-700 dark:text-sky-400" },
  AUDIO_READY: { label: "Аудио готово, не скачано", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  WAITING: { label: "Ждёт Google", className: "bg-sky-500/10 text-sky-700 dark:text-sky-400" },
  SHIPPING: { label: "Едет на сервер", className: "bg-sky-500/10 text-sky-700 dark:text-sky-400" },
  FAILED: { label: "Сбой, повторит", className: "bg-red-500/10 text-red-700 dark:text-red-400" },
  QUEUED: { label: "В очереди", className: "bg-foreground/5 text-foreground/60" },
  NO_SOURCE: { label: "Нет материала", className: "bg-foreground/5 text-foreground/40" },
};

const OUTCOME: Record<PodcastRunOutcome, string> = {
  RUNNING: "идёт",
  QUOTA: "упёрся в дневную квоту",
  DONE: "прошёл всю очередь",
  FAILED: "сорвался",
};

export default async function PodcastsPage() {
  const now = new Date();

  const [courses, runs] = await Promise.all([
    db.course.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        title: true,
        modules: {
          orderBy: { sortOrder: "asc" },
          select: {
            lessons: {
              orderBy: { sortOrder: "asc" },
              select: {
                id: true,
                title: true,
                podcastKey: true,
                aiArtifacts: {
                  where: { type: "SUMMARY", validation: "VALIDATED" },
                  select: { id: true },
                  take: 1,
                },
                transcript: { select: { status: true } },
                podcastStatus: { select: { state: true, message: true, attempts: true, updatedAt: true } },
              },
            },
          },
        },
      },
    }),
    db.podcastRun.findMany({ orderBy: { startedAt: "desc" }, take: 30 }),
  ]);

  const rows = courses.map((course) => {
    const lessons = course.modules.flatMap((m) => m.lessons).map((l) => ({
      ...l,
      view: lessonView({
        podcastKey: l.podcastKey,
        hasSource: l.aiArtifacts.length > 0 || l.transcript?.status === "CLEANED",
        state: l.podcastStatus?.state ?? null,
      }),
    }));
    return { ...course, lessons, counts: countViews(lessons.map((l) => l.view)) };
  });

  const counts = countViews(rows.flatMap((r) => r.lessons.map((l) => l.view)));
  const health = runnerHealth(runs[0] ?? null, now);
  const daysLeft = estimateDaysLeft(counts.remaining, runs, now);

  const healthCard = (() => {
    switch (health.kind) {
      case "NEVER":
        return { tone: "warn", value: "Не запускался", sub: "автопрогон на мини ещё ни разу не отметился" };
      case "RUNNING":
        return { tone: "ok", value: "Работает сейчас", sub: `начал ${ago(health.since, now)}` };
      case "STUCK":
        return { tone: "warn", value: "Завис?", sub: `прогон «идёт» с ${fmt(health.since)} — проверьте мини` };
      case "OK":
        return { tone: "ok", value: "На связи", sub: `последний прогон ${ago(health.last, now)}` };
      case "STALE":
        return { tone: "warn", value: "Пропустил запуск", sub: `последний прогон ${ago(health.last, now)} — мини выключен или без сети?` };
    }
  })();

  return (
    <main>
      <h1 className="text-2xl font-bold">Подкасты</h1>
      <p className="mt-1 max-w-3xl text-foreground/60">
        AI-подкасты уроков делает Mac mini через NotebookLM — {SCHEDULE_LABEL}. Бесплатная квота
        Google пускает около трёх подкастов в сутки, поэтому очередь идёт курсами: готовый урок
        сразу появляется у учеников, сбойный фабрика повторит сама.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-foreground/10 bg-background p-5">
          <CheckCircle2 className="size-5 text-amber-600" />
          <p className="mt-3 text-2xl font-bold">
            {counts.ready} <span className="text-base font-medium text-foreground/40">из {counts.total - counts.noSource}</span>
          </p>
          <p className="text-sm text-foreground/60">Подкастов на сайте</p>
          <p className="mt-0.5 text-xs text-foreground/40">
            {counts.noSource ? `ещё ${counts.noSource} уроков без материала` : "у всех уроков есть материал"}
          </p>
        </div>
        <div className="rounded-2xl border border-foreground/10 bg-background p-5">
          <Headphones className="size-5 text-amber-600" />
          <p className="mt-3 text-2xl font-bold">{counts.remaining}</p>
          <p className="text-sm text-foreground/60">Осталось сделать</p>
          <p className="mt-0.5 text-xs text-foreground/40">
            {counts.failed ? `из них со сбоем ${counts.failed}` : "сбоев нет"}
          </p>
        </div>
        <div className="rounded-2xl border border-foreground/10 bg-background p-5">
          <Clock className="size-5 text-amber-600" />
          <p className="mt-3 text-2xl font-bold">
            {daysLeft === null ? "—" : daysLeft === 0 ? "Готово" : `≈ ${daysLeft} дн`}
          </p>
          <p className="text-sm text-foreground/60">До конца очереди</p>
          <p className="mt-0.5 text-xs text-foreground/40">по темпу за последние 7 дней</p>
        </div>
        <div
          className={`rounded-2xl border p-5 ${
            healthCard.tone === "warn" ? "border-amber-500/40 bg-amber-500/[0.04]" : "border-foreground/10 bg-background"
          }`}
        >
          {healthCard.tone === "warn" ? (
            <AlertTriangle className="size-5 text-amber-600" />
          ) : (
            <Server className="size-5 text-amber-600" />
          )}
          <p className="mt-3 text-2xl font-bold">{healthCard.value}</p>
          <p className="text-sm text-foreground/60">Mac mini</p>
          <p className="mt-0.5 text-xs text-foreground/40">{healthCard.sub}</p>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Уроки</h2>
        <div className="mt-3 space-y-3">
          {rows.map((course) => {
            const withSource = course.counts.total - course.counts.noSource;
            const done = withSource > 0 && course.counts.ready === withSource;
            const percent = withSource ? Math.round((course.counts.ready / withSource) * 100) : 0;
            return (
              <details
                key={course.id}
                open={!done && withSource > 0}
                className="group overflow-hidden rounded-xl border border-foreground/10 bg-background"
              >
                <summary className="flex cursor-pointer list-none items-center gap-4 px-4 py-3">
                  <span className="min-w-0 flex-1 truncate font-medium">{course.title}</span>
                  <span className="hidden h-1.5 w-32 overflow-hidden rounded-full bg-foreground/10 sm:block">
                    <span className="block h-full bg-emerald-500" style={{ width: `${percent}%` }} />
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-foreground/60">
                    {withSource ? `${course.counts.ready} / ${withSource}` : "нет материала"}
                  </span>
                </summary>
                <div className="overflow-x-auto border-t border-foreground/10">
                  <table className="w-full text-sm">
                    <tbody>
                      {course.lessons.map((lesson) => {
                        const view = VIEW[lesson.view];
                        const status = lesson.podcastStatus;
                        return (
                          <tr key={lesson.id} className="border-b border-foreground/5 align-top last:border-0">
                            <td className="w-1/2 px-4 py-2.5">{lesson.title}</td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${view.className}`}>
                                {view.label}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-foreground/50">
                              {status && lesson.view !== "READY" ? (
                                <>
                                  {fmt(status.updatedAt)}
                                  {status.attempts > 1 ? ` · попыток: ${status.attempts}` : ""}
                                  {status.message ? (
                                    <span className="mt-0.5 block break-words text-foreground/40">{status.message}</span>
                                  ) : null}
                                </>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </details>
            );
          })}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Прогоны на Mac mini</h2>
        {runs.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-10 text-center text-foreground/50">
            <Server className="mx-auto size-10 opacity-30" />
            <p className="mt-3 font-medium">Прогонов пока не было</p>
            <p className="mt-1 text-sm">Строки появятся после первого запуска автопрогона на мини.</p>
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-foreground/10 bg-background">
            <table className="w-full text-sm">
              <thead className="border-b border-foreground/10 bg-foreground/[0.02] text-left text-xs uppercase tracking-wide text-foreground/50">
                <tr>
                  <th className="px-4 py-3 font-medium">Начало</th>
                  <th className="px-4 py-3 font-medium">Итог</th>
                  <th className="px-4 py-3 text-right font-medium">Подкастов</th>
                  <th className="px-4 py-3 text-right font-medium">Сбоев</th>
                  <th className="px-4 py-3 font-medium">Длительность</th>
                </tr>
              </thead>
              <tbody>
                {runs.slice(0, 12).map((r) => (
                  <tr key={r.id} className="border-b border-foreground/5 align-top last:border-0">
                    <td className="whitespace-nowrap px-4 py-2.5">{fmt(r.startedAt)}</td>
                    <td className="px-4 py-2.5">
                      <span className={r.outcome === "FAILED" ? "text-red-700 dark:text-red-400" : undefined}>
                        {OUTCOME[r.outcome]}
                      </span>
                      {r.message ? <span className="mt-0.5 block text-xs text-foreground/40">{r.message}</span> : null}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.generated}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-foreground/60">{r.failed}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-foreground/60">
                      {r.finishedAt ? `${Math.max(1, Math.round((r.finishedAt.getTime() - r.startedAt.getTime()) / 60_000))} мин` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
