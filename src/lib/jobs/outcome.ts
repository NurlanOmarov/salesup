import { isExhausted, nextRunAfter } from "./backoff.js";

/**
 * Чистое решение об исходе задачи после выполнения (S5.4) — без БД, юнит-тестируемо.
 * Успех → DONE. Неудача → ещё одна попытка (QUEUED с backoff) либо FAILED, если
 * исчерпан maxAttempts.
 */

export interface JobLike {
  attempts: number;
  maxAttempts: number;
}

export type JobOutcome =
  | { status: "DONE"; attempts: number; finishedAt: Date }
  | { status: "QUEUED"; attempts: number; runAfter: Date }
  | { status: "FAILED"; attempts: number; finishedAt: Date; lastError: string };

export function decideOutcome(
  job: JobLike,
  now: Date,
  error: Error | null,
): JobOutcome {
  const attempts = job.attempts + 1;

  if (!error) {
    return { status: "DONE", attempts, finishedAt: now };
  }

  if (isExhausted(attempts, job.maxAttempts)) {
    return {
      status: "FAILED",
      attempts,
      finishedAt: now,
      lastError: error.message.slice(0, 1000),
    };
  }

  return { status: "QUEUED", attempts, runAfter: nextRunAfter(now, attempts) };
}
