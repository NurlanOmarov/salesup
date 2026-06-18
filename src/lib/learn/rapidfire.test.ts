import { describe, it, expect } from "vitest";
import { comboMultiplier, scoreAnswer, RAPID_QUESTION_MS, RAPID_BASE_POINTS } from "./rapidfire";

/** Подсчёт очков rapid-fire: множитель серии, бонус за скорость, обнуление при ошибке. */
describe("comboMultiplier", () => {
  it("растёт по порогам серии", () => {
    expect(comboMultiplier(1)).toBe(1);
    expect(comboMultiplier(2)).toBe(1.5);
    expect(comboMultiplier(3)).toBe(1.5);
    expect(comboMultiplier(4)).toBe(2);
    expect(comboMultiplier(6)).toBe(3);
    expect(comboMultiplier(99)).toBe(3);
  });
});

describe("scoreAnswer", () => {
  it("ошибка/таймаут → 0", () => {
    expect(scoreAnswer(false, RAPID_QUESTION_MS, 5)).toBe(0);
    expect(scoreAnswer(false, 0, 1)).toBe(0);
  });

  it("верно с полным временем, первый в серии → база + полный бонус", () => {
    // ratio=1 → timeBonus=100; (100+100)*1 = 200
    expect(scoreAnswer(true, RAPID_QUESTION_MS, 1)).toBe(2 * RAPID_BASE_POINTS);
  });

  it("учитывает оставшееся время (половина → половина бонуса)", () => {
    // ratio=0.5 → timeBonus=50; (100+50)*1 = 150
    expect(scoreAnswer(true, RAPID_QUESTION_MS / 2, 1)).toBe(150);
  });

  it("применяет комбо-множитель серии", () => {
    // полный бонус 200 * 1.5 (серия 2) = 300
    expect(scoreAnswer(true, RAPID_QUESTION_MS, 2)).toBe(300);
    // полный бонус 200 * 3 (серия 6) = 600
    expect(scoreAnswer(true, RAPID_QUESTION_MS, 6)).toBe(600);
  });

  it("ответ в последний момент (0 мс) → только база", () => {
    expect(scoreAnswer(true, 0, 1)).toBe(RAPID_BASE_POINTS);
  });

  it("кламп при отрицательном/избыточном времени", () => {
    expect(scoreAnswer(true, -500, 1)).toBe(RAPID_BASE_POINTS);
    expect(scoreAnswer(true, RAPID_QUESTION_MS * 2, 1)).toBe(2 * RAPID_BASE_POINTS);
  });
});
