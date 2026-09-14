import { describe, it, expect } from "vitest";
import { countViews, estimateDaysLeft, lessonView, runnerHealth, type RunLike } from "./podcast-status.js";

const now = new Date("2026-09-14T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000);
const run = (h: number, generated: number, outcome: RunLike["outcome"] = "QUOTA"): RunLike => ({
  startedAt: hoursAgo(h),
  finishedAt: outcome === "RUNNING" ? null : hoursAgo(h - 1),
  outcome,
  generated,
});

describe("lessonView", () => {
  it("подкаст на проде важнее любого статуса", () => {
    expect(lessonView({ podcastKey: "courses/a/lessons/b/podcast.m4a", hasSource: true, state: "FAILED" })).toBe("READY");
  });
  it("статус фабрики показывается, пока подкаста нет", () => {
    expect(lessonView({ podcastKey: null, hasSource: true, state: "AUDIO_READY" })).toBe("AUDIO_READY");
  });
  it("без статуса — в очереди, а без материала — не из чего делать", () => {
    expect(lessonView({ podcastKey: null, hasSource: true, state: null })).toBe("QUEUED");
    expect(lessonView({ podcastKey: null, hasSource: false, state: null })).toBe("NO_SOURCE");
  });
});

describe("countViews", () => {
  it("сбойные уроки остаются в очереди, уроки без материала — нет", () => {
    expect(countViews(["READY", "READY", "QUEUED", "FAILED", "GENERATING", "NO_SOURCE"])).toEqual({
      total: 6,
      ready: 2,
      remaining: 3,
      failed: 1,
      noSource: 1,
    });
  });
});

describe("runnerHealth", () => {
  it("прогонов не было", () => {
    expect(runnerHealth(null, now)).toEqual({ kind: "NEVER" });
  });
  it("свежий прогон — всё в порядке, пропущенный старт — тревога", () => {
    expect(runnerHealth(run(10, 1), now).kind).toBe("OK");
    expect(runnerHealth(run(20, 1), now).kind).toBe("STALE");
  });
  it("идущий прогон, и прогон, который «идёт» слишком долго", () => {
    expect(runnerHealth(run(2, 0, "RUNNING"), now).kind).toBe("RUNNING");
    expect(runnerHealth(run(9, 0, "RUNNING"), now).kind).toBe("STUCK");
  });
});

describe("estimateDaysLeft", () => {
  it("очередь пуста — ноль дней", () => {
    expect(estimateDaysLeft(0, [], now)).toBe(0);
  });
  it("темпа нет — оценки нет", () => {
    expect(estimateDaysLeft(10, [], now)).toBeNull();
    expect(estimateDaysLeft(10, [run(5, 0)], now)).toBeNull();
  });
  it("темп считается по неделе: 9 подкастов за 3 дня — 3 в день", () => {
    const runs = [run(72, 3), run(48, 3), run(24, 3)];
    expect(estimateDaysLeft(30, runs, now)).toBe(10);
  });
  it("прогоны старше недели не в счёт", () => {
    expect(estimateDaysLeft(10, [run(24 * 8, 50)], now)).toBeNull();
  });
  it("первый час работы не обещает чудес: окно не короче суток", () => {
    expect(estimateDaysLeft(10, [run(1, 2)], now)).toBe(5);
  });
});
