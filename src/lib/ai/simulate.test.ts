import { describe, it, expect } from "vitest";
import { buildScorecard } from "./simulate";

/**
 * Подсчёт scorecard симулятора: взвешенный overallPct по DEFAULT_RUBRIC,
 * compliance instant-fail (любой fail-флаг → passed=false), отбрасывание мусора.
 */
describe("buildScorecard", () => {
  it("считает overallPct как взвешенное по рубрике", () => {
    // все фазы по 100, кроме discovery=0 (вес 0.25) → 75
    const card = buildScorecard({
      phases: [
        { phase: "opening", label: "Открытие", score: 100, comment: "" },
        { phase: "discovery", label: "Потребность", score: 0, comment: "" },
        { phase: "presentation", label: "Презентация", score: 100, comment: "" },
        { phase: "objections", label: "Возражения", score: 100, comment: "" },
        { phase: "closing", label: "Закрытие", score: 100, comment: "" },
      ],
      passed: true,
    });
    expect(card.overallPct).toBe(75);
    expect(card.passed).toBe(true);
  });

  it("нормализует веса, если модель вернула не все фазы", () => {
    // только две фазы по 80 → среднее 80 (веса нормализуются)
    const card = buildScorecard({
      phases: [
        { phase: "opening", label: "Открытие", score: 80, comment: "" },
        { phase: "closing", label: "Закрытие", score: 80, comment: "" },
      ],
      passed: true,
    });
    expect(card.overallPct).toBe(80);
  });

  it("compliance instant-fail: любой fail-флаг → passed=false даже при passed:true от модели", () => {
    const card = buildScorecard({
      phases: [{ phase: "opening", label: "Открытие", score: 100, comment: "" }],
      passed: true,
      complianceFlags: [
        { severity: "fail", rule: "Необоснованное обещание", quote: "100% вылечит", explanation: "Нет данных" },
      ],
    });
    expect(card.passed).toBe(false);
    expect(card.complianceFlags).toHaveLength(1);
  });

  it("warn-флаг не валит passed", () => {
    const card = buildScorecard({
      phases: [{ phase: "opening", label: "Открытие", score: 100, comment: "" }],
      passed: true,
      complianceFlags: [{ severity: "warn", rule: "Дозировка", quote: "по 2 таблетки", explanation: "Сослаться на инструкцию" }],
    });
    expect(card.passed).toBe(true);
  });

  it("отбрасывает неизвестные фазы и невалидные флаги", () => {
    const card = buildScorecard({
      phases: [
        { phase: "opening", label: "Открытие", score: 90, comment: "ок" },
        { phase: "smalltalk" as never, label: "Болтовня", score: 50, comment: "" },
      ],
      complianceFlags: [{ severity: "bogus" as never, rule: "x", quote: "y", explanation: "z" }],
    });
    expect(card.phases).toHaveLength(1);
    expect(card.complianceFlags).toHaveLength(0);
    expect(card.overallPct).toBe(90);
  });

  it("пустой ответ модели → нулевой безопасный scorecard, passed=true (нет fail)", () => {
    const card = buildScorecard({});
    expect(card.overallPct).toBe(0);
    expect(card.phases).toEqual([]);
    expect(card.passed).toBe(true);
    expect(card.strengths).toEqual([]);
  });

  it("ограничивает score диапазоном 0..100", () => {
    const card = buildScorecard({
      phases: [
        { phase: "opening", label: "o", score: 150, comment: "" },
        { phase: "closing", label: "c", score: -20, comment: "" },
      ],
    });
    const opening = card.phases.find((p) => p.phase === "opening");
    const closing = card.phases.find((p) => p.phase === "closing");
    expect(opening?.score).toBe(100);
    expect(closing?.score).toBe(0);
  });
});
