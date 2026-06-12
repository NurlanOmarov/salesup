import { describe, it, expect } from "vitest";
import { decideOutcome } from "./outcome.js";

const NOW = new Date("2026-06-12T12:00:00.000Z");

describe("decideOutcome", () => {
  it("успех → DONE с инкрементом попытки", () => {
    const r = decideOutcome({ attempts: 0, maxAttempts: 3 }, NOW, null);
    expect(r.status).toBe("DONE");
    expect(r.attempts).toBe(1);
    if (r.status === "DONE") expect(r.finishedAt).toEqual(NOW);
  });

  it("первая неудача (есть ещё попытки) → QUEUED с backoff", () => {
    const r = decideOutcome({ attempts: 0, maxAttempts: 3 }, NOW, new Error("boom"));
    expect(r.status).toBe("QUEUED");
    expect(r.attempts).toBe(1);
    // backoff для attempts=1 → +30с
    if (r.status === "QUEUED") expect(r.runAfter.toISOString()).toBe("2026-06-12T12:00:30.000Z");
  });

  it("вторая неудача → QUEUED с большим backoff", () => {
    const r = decideOutcome({ attempts: 1, maxAttempts: 3 }, NOW, new Error("boom"));
    expect(r.attempts).toBe(2);
    if (r.status === "QUEUED") expect(r.runAfter.toISOString()).toBe("2026-06-12T12:01:00.000Z");
  });

  it("последняя неудача (исчерпаны попытки) → FAILED", () => {
    const r = decideOutcome({ attempts: 2, maxAttempts: 3 }, NOW, new Error("fatal error"));
    expect(r.status).toBe("FAILED");
    expect(r.attempts).toBe(3);
    if (r.status === "FAILED") {
      expect(r.lastError).toBe("fatal error");
      expect(r.finishedAt).toEqual(NOW);
    }
  });

  it("длинная ошибка обрезается до 1000 символов", () => {
    const r = decideOutcome({ attempts: 2, maxAttempts: 3 }, NOW, new Error("x".repeat(5000)));
    if (r.status === "FAILED") expect(r.lastError.length).toBe(1000);
  });

  it("maxAttempts=1: первая же неудача → FAILED", () => {
    const r = decideOutcome({ attempts: 0, maxAttempts: 1 }, NOW, new Error("boom"));
    expect(r.status).toBe("FAILED");
  });
});
