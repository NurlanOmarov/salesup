import { describe, it, expect } from "vitest";
import { nextStreak } from "./streak.js";

const d = (s: string) => new Date(`${s}T12:00:00.000Z`);

describe("nextStreak", () => {
  it("первая активность → 1", () => {
    expect(nextStreak(null, d("2026-06-12"), 0)).toBe(1);
  });
  it("повторная активность в тот же день → без изменений", () => {
    expect(nextStreak(d("2026-06-12"), d("2026-06-12"), 5)).toBe(5);
  });
  it("активность на следующий день → +1", () => {
    expect(nextStreak(d("2026-06-12"), d("2026-06-13"), 5)).toBe(6);
  });
  it("пропуск дня → сброс до 1", () => {
    expect(nextStreak(d("2026-06-12"), d("2026-06-14"), 5)).toBe(1);
  });
  it("большой перерыв → сброс до 1", () => {
    expect(nextStreak(d("2026-06-01"), d("2026-06-12"), 9)).toBe(1);
  });
  it("тот же день при нулевой серии → минимум 1", () => {
    expect(nextStreak(d("2026-06-12"), d("2026-06-12"), 0)).toBe(1);
  });
});
