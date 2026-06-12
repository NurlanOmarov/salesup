import { describe, it, expect } from "vitest";
import { gradeQuestion, scoreAttempt, normalizeAnswer, type QuestionLike } from "./scoring.js";

const ordering: QuestionLike = {
  id: "qo",
  type: "ORDERING",
  points: 2,
  options: [
    { id: "s", isCorrect: true, sortOrder: 0 }, // ситуационные
    { id: "p", isCorrect: true, sortOrder: 1 }, // проблемные
    { id: "i", isCorrect: true, sortOrder: 2 }, // извлекающие
    { id: "n", isCorrect: true, sortOrder: 3 }, // направляющие
  ],
};

const fill: QuestionLike = {
  id: "qf",
  type: "FILL_BLANK",
  points: 1,
  options: [
    { id: "b1", isCorrect: true, sortOrder: 0, text: "факт" },
    { id: "b2", isCorrect: true, sortOrder: 1, text: "выгода" },
    { id: "b3", isCorrect: true, sortOrder: 2, text: "согласие" },
  ],
};

describe("gradeQuestion — ORDERING", () => {
  it("правильный порядок → балл", () => {
    expect(gradeQuestion(ordering, ["s", "p", "i", "n"])).toEqual({ correct: true, points: 2 });
  });
  it("неправильный порядок → 0", () => {
    expect(gradeQuestion(ordering, ["p", "s", "i", "n"]).correct).toBe(false);
  });
  it("неполный ответ → 0", () => {
    expect(gradeQuestion(ordering, ["s", "p", "i"]).correct).toBe(false);
  });
});

describe("gradeQuestion — FILL_BLANK", () => {
  it("точное совпадение → балл", () => {
    expect(gradeQuestion(fill, ["факт", "выгода", "согласие"])).toEqual({ correct: true, points: 1 });
  });
  it("регистр и пунктуация игнорируются", () => {
    expect(gradeQuestion(fill, ["Факт", " ВЫГОДА ", "согласие!"]).correct).toBe(true);
  });
  it("ё нормализуется к е", () => {
    const q: QuestionLike = { id: "x", type: "FILL_BLANK", points: 1, options: [{ id: "a", isCorrect: true, sortOrder: 0, text: "приём" }] };
    expect(gradeQuestion(q, ["прием"]).correct).toBe(true);
  });
  it("неверное слово → 0", () => {
    expect(gradeQuestion(fill, ["факт", "цена", "согласие"]).correct).toBe(false);
  });
});

describe("normalizeAnswer", () => {
  it("приводит к нижнему регистру, убирает пунктуацию и лишние пробелы", () => {
    expect(normalizeAnswer("  Факт, выгода!  ")).toBe("факт выгода");
  });
});

const matching: QuestionLike = {
  id: "qm",
  type: "MATCHING",
  points: 2,
  options: [
    { id: "a", isCorrect: true, sortOrder: 0, text: "Язык пользы", pairKey: "меньше риск инсульта" },
    { id: "b", isCorrect: true, sortOrder: 1, text: "Визуализация", pairKey: "графики и таблицы" },
  ],
};

const categorization: QuestionLike = {
  id: "qc",
  type: "CATEGORIZATION",
  points: 2,
  options: [
    { id: "a", isCorrect: true, sortOrder: 0, text: "Подводи к действию", pairKey: "Делай" },
    { id: "b", isCorrect: true, sortOrder: 1, text: "Спрашивай в лоб", pairKey: "Не делай" },
  ],
};

describe("gradeQuestion — MATCHING", () => {
  it("все пары верны → балл", () => {
    expect(gradeQuestion(matching, ["меньше риск инсульта", "графики и таблицы"])).toEqual({ correct: true, points: 2 });
  });
  it("одна пара неверна → 0", () => {
    expect(gradeQuestion(matching, ["графики и таблицы", "меньше риск инсульта"]).correct).toBe(false);
  });
  it("нормализация (регистр/пунктуация)", () => {
    expect(gradeQuestion(matching, ["Меньше риск инсульта!", "Графики и таблицы"]).correct).toBe(true);
  });
});

describe("gradeQuestion — CATEGORIZATION", () => {
  it("все категории верны → балл", () => {
    expect(gradeQuestion(categorization, ["Делай", "Не делай"])).toEqual({ correct: true, points: 2 });
  });
  it("перепутаны категории → 0", () => {
    expect(gradeQuestion(categorization, ["Не делай", "Делай"]).correct).toBe(false);
  });
});

const practice: QuestionLike = { id: "qp", type: "PRACTICE", points: 1, options: [] };

describe("gradeQuestion — PRACTICE", () => {
  it("содержательный ответ → зачёт за попытку", () => {
    expect(gradeQuestion(practice, ["Как часто к вам обращаются с этими симптомами?"]).correct).toBe(true);
  });
  it("пустой/слишком короткий ответ → не зачтено", () => {
    expect(gradeQuestion(practice, [""]).correct).toBe(false);
    expect(gradeQuestion(practice, ["ок"]).correct).toBe(false);
  });
});

const scenario: QuestionLike = {
  id: "qs",
  type: "SCENARIO",
  points: 1,
  options: [
    { id: "a", isCorrect: false },
    { id: "b", isCorrect: true },
    { id: "c", isCorrect: false },
  ],
};

describe("gradeQuestion — SCENARIO", () => {
  it("выбран лучший ответ → балл", () => {
    expect(gradeQuestion(scenario, ["b"])).toEqual({ correct: true, points: 1 });
  });
  it("выбран неудачный ответ → 0", () => {
    expect(gradeQuestion(scenario, ["a"]).correct).toBe(false);
  });
});

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
