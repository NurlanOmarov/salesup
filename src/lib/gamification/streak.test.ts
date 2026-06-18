import { describe, it, expect } from "vitest";
import { nextStreak, applyStreak, FREEZE_EARN_EVERY, MAX_STREAK_FREEZES } from "./streak.js";

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

describe("applyStreak (заморозки)", () => {
  it("следующий день → +1, заморозки не тратятся", () => {
    const r = applyStreak(d("2026-06-12"), d("2026-06-13"), 5, 1);
    expect(r.streak).toBe(6);
    expect(r.freezes).toBe(1);
    expect(r.usedFreeze).toBe(false);
  });

  it("пропуск 1 дня при наличии заморозки → серия сохраняется, заморозка тратится", () => {
    const r = applyStreak(d("2026-06-12"), d("2026-06-14"), 5, 1);
    expect(r.streak).toBe(5);
    expect(r.freezes).toBe(0);
    expect(r.usedFreeze).toBe(true);
  });

  it("пропуск 1 дня без заморозок → сброс до 1", () => {
    const r = applyStreak(d("2026-06-12"), d("2026-06-14"), 5, 0);
    expect(r.streak).toBe(1);
    expect(r.usedFreeze).toBe(false);
  });

  it("пропуск 2 дней тратит 2 заморозки, если есть", () => {
    const r = applyStreak(d("2026-06-12"), d("2026-06-15"), 5, 2);
    expect(r.streak).toBe(5);
    expect(r.freezes).toBe(0);
    expect(r.usedFreeze).toBe(true);
  });

  it("пропуск 2 дней при 1 заморозке → не хватает, сброс", () => {
    const r = applyStreak(d("2026-06-12"), d("2026-06-15"), 5, 1);
    expect(r.streak).toBe(1);
    expect(r.freezes).toBe(1); // заморозка не тратится впустую
  });

  it(`начисляет заморозку каждые ${FREEZE_EARN_EVERY} дней серии (до максимума)`, () => {
    // серия 6 → 7: кратно 7, заморозка начисляется
    const r = applyStreak(d("2026-06-12"), d("2026-06-13"), FREEZE_EARN_EVERY - 1, 0);
    expect(r.streak).toBe(FREEZE_EARN_EVERY);
    expect(r.earnedFreeze).toBe(true);
    expect(r.freezes).toBe(1);
  });

  it("не превышает максимум заморозок", () => {
    const r = applyStreak(d("2026-06-12"), d("2026-06-13"), FREEZE_EARN_EVERY - 1, MAX_STREAK_FREEZES);
    expect(r.earnedFreeze).toBe(false);
    expect(r.freezes).toBe(MAX_STREAK_FREEZES);
  });

  it("первая активность → 1, заморозки без изменений", () => {
    const r = applyStreak(null, d("2026-06-12"), 0, 1);
    expect(r.streak).toBe(1);
    expect(r.freezes).toBe(1);
  });
});
