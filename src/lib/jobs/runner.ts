import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { decideOutcome, type JobLike, type JobOutcome } from "./outcome.js";
import { handlers, type JobHandler } from "./handlers/index.js";

/**
 * Исполнение фоновых задач (S5.4). Атомарный захват через FOR UPDATE SKIP LOCKED —
 * несколько воркеров не возьмут одну задачу. Ретраи/исход — через чистый decideOutcome.
 */

export interface ClaimedJob extends JobLike {
  id: string;
  type: string;
  payload: unknown;
}

/**
 * Выполнить один обработчик и записать исход. Выделено для юнит-тестов:
 * принимает handler и persist через DI, не трогает БД напрямую.
 */
export async function runJob(
  job: ClaimedJob,
  handler: JobHandler | undefined,
  deps: { now: Date; persist: (jobId: string, outcome: JobOutcome) => Promise<void> },
): Promise<JobOutcome> {
  let error: Error | null = null;
  if (!handler) {
    error = new Error(`Нет обработчика для типа "${job.type}"`);
  } else {
    try {
      await handler(job.payload);
    } catch (e) {
      error = e instanceof Error ? e : new Error(String(e));
    }
  }

  const outcome = decideOutcome(job, deps.now, error);
  await deps.persist(job.id, outcome);
  return outcome;
}

/** Записать исход задачи в БД. */
async function persistOutcome(jobId: string, outcome: JobOutcome): Promise<void> {
  if (outcome.status === "DONE") {
    await db.job.update({
      where: { id: jobId },
      data: { status: "DONE", attempts: outcome.attempts, finishedAt: outcome.finishedAt, lastError: null },
    });
  } else if (outcome.status === "FAILED") {
    await db.job.update({
      where: { id: jobId },
      data: { status: "FAILED", attempts: outcome.attempts, finishedAt: outcome.finishedAt, lastError: outcome.lastError },
    });
  } else {
    await db.job.update({
      where: { id: jobId },
      data: { status: "QUEUED", attempts: outcome.attempts, runAfter: outcome.runAfter },
    });
  }
}

/**
 * Атомарно захватить следующую готовую задачу (status=QUEUED, runAfter ≤ now),
 * переведя её в RUNNING. Возвращает null, если очередь пуста.
 */
export async function claimNextJob(): Promise<ClaimedJob | null> {
  const rows = await db.$queryRaw<
    { id: string; type: string; payload: unknown; attempts: number; maxAttempts: number }[]
  >`
    UPDATE "Job" SET status = 'RUNNING'
    WHERE id = (
      SELECT id FROM "Job"
      WHERE status = 'QUEUED' AND "runAfter" <= NOW()
      ORDER BY "runAfter" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id, type, payload, attempts, "maxAttempts";
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    payload: row.payload,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
  };
}

/** Обработать одну задачу из очереди. Возвращает true, если задача была. */
export async function processOnce(now: Date = new Date()): Promise<boolean> {
  const job = await claimNextJob();
  if (!job) return false;

  const outcome = await runJob(job, handlers[job.type], { now, persist: persistOutcome });
  if (outcome.status === "FAILED") {
    log.warn({ jobId: job.id, type: job.type }, "Задача провалена окончательно");
  } else if (outcome.status === "QUEUED") {
    log.info({ jobId: job.id, type: job.type, attempts: outcome.attempts }, "Задача будет повторена");
  }
  return true;
}

/** Обработать до `limit` задач за проход (пока очередь не пуста). */
export async function processBatch(limit = 20, now: Date = new Date()): Promise<number> {
  let processed = 0;
  while (processed < limit) {
    const had = await processOnce(now);
    if (!had) break;
    processed++;
  }
  return processed;
}
