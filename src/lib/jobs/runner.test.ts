import { describe, it, expect, vi } from "vitest";
import { runJob, type ClaimedJob } from "./runner.js";
import type { JobOutcome } from "./outcome.js";

const NOW = new Date("2026-06-12T12:00:00.000Z");
const job = (over: Partial<ClaimedJob> = {}): ClaimedJob => ({
  id: "j1",
  type: "noop",
  payload: {},
  attempts: 0,
  maxAttempts: 3,
  ...over,
});

describe("runJob", () => {
  it("успешный обработчик → DONE, persist вызван один раз", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const persist = vi.fn<(id: string, o: JobOutcome) => Promise<void>>().mockResolvedValue();

    const outcome = await runJob(job(), handler, { now: NOW, persist });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(outcome.status).toBe("DONE");
    expect(persist).toHaveBeenCalledWith("j1", expect.objectContaining({ status: "DONE" }));
  });

  it("обработчик бросил, есть попытки → QUEUED (повтор)", async () => {
    const handler = vi.fn().mockRejectedValue(new Error("boom"));
    const persist = vi.fn().mockResolvedValue(undefined);

    const outcome = await runJob(job({ attempts: 0 }), handler, { now: NOW, persist });

    expect(outcome.status).toBe("QUEUED");
    expect(outcome.attempts).toBe(1);
  });

  it("обработчик бросил на последней попытке → FAILED", async () => {
    const handler = vi.fn().mockRejectedValue(new Error("fatal"));
    const persist = vi.fn().mockResolvedValue(undefined);

    const outcome = await runJob(job({ attempts: 2, maxAttempts: 3 }), handler, { now: NOW, persist });

    expect(outcome.status).toBe("FAILED");
    if (outcome.status === "FAILED") expect(outcome.lastError).toBe("fatal");
  });

  it("нет обработчика для типа → FAILED-ветка без вызова handler", async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const outcome = await runJob(job({ type: "unknown.type", attempts: 2 }), undefined, { now: NOW, persist });
    expect(outcome.status).toBe("FAILED");
  });

  it("идемпотентность вызова: обработчик не вызывается дважды за один проход", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const persist = vi.fn().mockResolvedValue(undefined);
    await runJob(job(), handler, { now: NOW, persist });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("не-Error исключение оборачивается", async () => {
    const handler = vi.fn().mockRejectedValue("строковая ошибка");
    const persist = vi.fn().mockResolvedValue(undefined);
    const outcome = await runJob(job({ attempts: 2 }), handler, { now: NOW, persist });
    expect(outcome.status).toBe("FAILED");
    if (outcome.status === "FAILED") expect(outcome.lastError).toContain("строковая ошибка");
  });
});
