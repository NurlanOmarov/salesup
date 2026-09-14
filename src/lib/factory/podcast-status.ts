import type { PodcastRunOutcome, PodcastState } from "@prisma/client";

/**
 * Как админка показывает фабрику подкастов (/admin/podcasts).
 *
 * Факт «подкаст есть» — Lesson.podcastKey; ход работы — PodcastLessonStatus и
 * PodcastRun, их пишет автопрогон на Mac mini (scripts/factory/podcast.ts --queue).
 * Здесь только чистые функции: страница собирает данные, решения — тут.
 */

/** Итоговое состояние урока глазами владельца. */
export type LessonPodcastView = "READY" | "NO_SOURCE" | "QUEUED" | PodcastState;

/** Автопрогон стартует в 9:17 и 21:17 — между стартами не больше 12 часов. */
export const SCHEDULE_LABEL = "дважды в сутки, в 9:17 и 21:17 по Астане";
const MAX_GAP_MS = 14 * 60 * 60 * 1000; // 12 ч между стартами + запас на долгий прогон

/** Прогон, который «идёт» дольше этого, почти наверняка оборвался (мини перезагрузился). */
const STUCK_RUN_MS = 6 * 60 * 60 * 1000;

export function lessonView(input: {
  podcastKey: string | null;
  hasSource: boolean;
  state: PodcastState | null;
}): LessonPodcastView {
  if (input.podcastKey) return "READY";
  if (input.state) return input.state;
  return input.hasSource ? "QUEUED" : "NO_SOURCE";
}

export interface PodcastCounts {
  total: number;
  ready: number;
  /** Ещё предстоит: в очереди, в работе или со сбоем — всё, что фабрика доделает сама. */
  remaining: number;
  failed: number;
  noSource: number;
}

export function countViews(views: LessonPodcastView[]): PodcastCounts {
  const counts: PodcastCounts = { total: views.length, ready: 0, remaining: 0, failed: 0, noSource: 0 };
  for (const v of views) {
    if (v === "READY") counts.ready++;
    else if (v === "NO_SOURCE") counts.noSource++;
    else {
      counts.remaining++;
      if (v === "FAILED") counts.failed++;
    }
  }
  return counts;
}

export interface RunLike {
  startedAt: Date;
  finishedAt: Date | null;
  outcome: PodcastRunOutcome;
  generated: number;
}

export type RunnerHealth =
  | { kind: "NEVER" }
  | { kind: "RUNNING"; since: Date }
  | { kind: "STUCK"; since: Date }
  | { kind: "OK"; last: Date }
  | { kind: "STALE"; last: Date };

/** Жив ли автопрогон: по последнему старту и расписанию. */
export function runnerHealth(lastRun: RunLike | null, now: Date): RunnerHealth {
  if (!lastRun) return { kind: "NEVER" };
  const age = now.getTime() - lastRun.startedAt.getTime();
  if (lastRun.outcome === "RUNNING") {
    return age > STUCK_RUN_MS ? { kind: "STUCK", since: lastRun.startedAt } : { kind: "RUNNING", since: lastRun.startedAt };
  }
  return age > MAX_GAP_MS ? { kind: "STALE", last: lastRun.startedAt } : { kind: "OK", last: lastRun.startedAt };
}

/**
 * Сколько дней до конца очереди при нынешнем темпе — по подкастам за последние
 * 7 дней. null, если темпа ещё нет (прогонов не было или все упёрлись в сбой).
 */
export function estimateDaysLeft(remaining: number, runs: RunLike[], now: Date): number | null {
  if (remaining === 0) return 0;
  const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const recent = runs.filter((r) => r.startedAt.getTime() >= weekAgo);
  if (!recent.length) return null;
  const generated = recent.reduce((sum, r) => sum + r.generated, 0);
  if (!generated) return null;
  // Окно — от первого прогона в неделе до сейчас, но не меньше суток: иначе два
  // подкаста за первый час обещали бы закончить всё к обеду.
  const first = Math.min(...recent.map((r) => r.startedAt.getTime()));
  const days = Math.max(1, (now.getTime() - first) / (24 * 60 * 60 * 1000));
  return Math.ceil(remaining / (generated / days));
}
