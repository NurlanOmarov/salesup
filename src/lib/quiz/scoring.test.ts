import { describe, it, expect } from "vitest";
import { gradeQuestion, scoreAttempt, type QuestionLike } from "./scoring.js";

const single: QuestionLike = {
  id: "q1",
  type: "SINGLE_CHOICE",
  points: 1,
  options: [
    { id: "a", isCorrect: false },
    { id: "b", isCorrect: true },
    { id: "c", isCorrect: false },
  ],
};

const multi: QuestionLike = {
  id: "q2",
  type: "MULTI_CHOICE",
  points: 2,
  options: [
    { id: "a", isCorrect: true },
    { id: "b", isCorrect: true },
    { id: "c", isCorrect: false },
  ],
};

const tf: QuestionLike = {
  id: "q3",
  type: "TRUE_FALSE",
  points: 1,
  options: [
    { id: "t", isCorrect: true },
    { id: "f", isCorrect: false },
  ],
};

describe("gradeQuestion — SINGLE_CHOICE", () => {
  it("верный выбор → балл", () => {
    expect(gradeQuestion(single, ["b"])).toEqual({ correct: true, points: 1 });
  });
  it("неверный выбор → 0", () => {
    expect(gradeQuestion(single, ["a"])).toEqual({ correct: false, points: 0 });
  });
  it("несколько выбранных в single → неверно", () => {
    expect(gradeQuestion(single, ["a", "b"]).correct).toBe(false);
  });
  it("пустой ответ → неверно", () => {
    expect(gradeQuestion(single, []).correct).toBe(false);
  });
});

describe("gradeQuestion — MULTI_CHOICE (всё-или-ничего)", () => {
  it("все правильные → балл", () => {
    expect(gradeQuestion(multi, ["a", "b"])).toEqual({ correct: true, points: 2 });
  });
  it("частично правильно → 0", () => {
    expect(gradeQuestion(multi, ["a"])).toEqual({ correct: false, points: 0 });
  });
  it("правильные + лишний неправильный → 0", () => {
    expect(gradeQuestion(multi, ["a", "b", "c"]).correct).toBe(false);
  });
  it("пусто → 0", () => {
    expect(gradeQuestion(multi, []).correct).toBe(false);
  });
});

describe("gradeQuestion — TRUE_FALSE", () => {
  it("верно", () => {
    expect(gradeQuestion(tf, ["t"]).correct).toBe(true);
  });
  it("неверно", () => {
    expect(gradeQuestion(tf, ["f"]).correct).toBe(false);
  });
});

describe("scoreAttempt", () => {
  const questions = [single, multi, tf]; // всего points: 1+2+1 = 4

  it("все верно → 100%, passed", () => {
    const r = scoreAttempt(questions, { q1: ["b"], q2: ["a", "b"], q3: ["t"] }, 80);
    expect(r.earnedPoints).toBe(4);
    expect(r.scorePct).toBe(100);
    expect(r.passed).toBe(true);
  });

  it("половина баллов → 50%, не passed при пороге 80", () => {
    // q2 верно (2 балла из 4) = 50%
    const r = scoreAttempt(questions, { q1: ["a"], q2: ["a", "b"], q3: ["f"] }, 80);
    expect(r.earnedPoints).toBe(2);
    expect(r.scorePct).toBe(50);
    expect(r.passed).toBe(false);
  });

  it("ровно на пороге → passed", () => {
    // 3 из 4 = 75%
    const r = scoreAttempt(questions, { q1: ["b"], q2: ["a", "b"], q3: ["f"] }, 75);
    expect(r.scorePct).toBe(75);
    expect(r.passed).toBe(true);
  });

  it("пропущенные вопросы считаются неверными", () => {
    const r = scoreAttempt(questions, { q1: ["b"] }, 80);
    expect(r.earnedPoints).toBe(1);
    expect(r.scorePct).toBe(25);
  });

  it("округление процента", () => {
    // 1 из 4 = 25%; 2 вопроса по 1 баллу из 3 вопросов...
    const r = scoreAttempt([single, tf, multi], { q1: ["b"], q3: ["t"] }, 80);
    // earned 1+1=2 из 4 = 50
    expect(r.scorePct).toBe(50);
  });

  it("пустой тест → 0%", () => {
    expect(scoreAttempt([], {}, 80)).toMatchObject({ scorePct: 0, passed: false });
  });
});
