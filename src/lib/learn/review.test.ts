import { describe, it, expect } from "vitest";
import { nextReviewState, REVIEW_INTERVALS_DAYS, MAX_BOX } from "./review";

/**
 * Расчёт интервального повторения (Leitner-lite): шаг вверх при «запомнил»,
 * сброс в box 0 при «не помню», корректные интервалы и кламп на верхней ступени.
 */
const NOW = new Date("2026-06-17T10:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const daysBetween = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / DAY);

describe("nextReviewState", () => {
  it("новая карточка (box 0) при «запомнил» → box 1, интервал 1 день", () => {
    const n = nextReviewState({ box: 0, repetitions: 0, lapses: 0 }, true, NOW);
    expect(n.box).toBe(1);
    expect(daysBetween(n.dueAt, NOW)).toBe(REVIEW_INTERVALS_DAYS[0]);
    expect(n.repetitions).toBe(1);
    expect(n.lastResult).toBe(true);
  });

  it("идёт по ступеням 1→3→7→30 дней", () => {
    let s = { box: 0, repetitions: 0, lapses: 0 };
    const expected = [1, 3, 7, 30];
    for (let i = 0; i < expected.length; i++) {
      const n = nextReviewState(s, true, NOW);
      expect(daysBetween(n.dueAt, NOW)).toBe(expected[i]);
      s = { box: n.box, repetitions: n.repetitions, lapses: n.lapses };
    }
  });

  it("не превышает MAX_BOX и держит максимальный интервал", () => {
    const n = nextReviewState({ box: MAX_BOX, repetitions: 9, lapses: 0 }, true, NOW);
    expect(n.box).toBe(MAX_BOX);
    expect(daysBetween(n.dueAt, NOW)).toBe(REVIEW_INTERVALS_DAYS[REVIEW_INTERVALS_DAYS.length - 1]);
  });

  it("«не помню» → сброс в box 0, +1 lapse, повтор через 1 день", () => {
    const n = nextReviewState({ box: 3, repetitions: 5, lapses: 1 }, false, NOW);
    expect(n.box).toBe(0);
    expect(n.lapses).toBe(2);
    expect(n.repetitions).toBe(6);
    expect(daysBetween(n.dueAt, NOW)).toBe(1);
    expect(n.lastResult).toBe(false);
  });
});
