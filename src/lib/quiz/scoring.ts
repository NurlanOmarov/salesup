/**
 * Оценка ответов на тест (S4.1). Чистая логика без БД — юнит-тестируема.
 * Правильные ответы НИКОГДА не уходят на клиент: оценка выполняется на сервере
 * через эти функции (CLAUDE.md, правило 1 по духу — проверка только сервером).
 *
 * В MVP поддержаны choice-типы: SINGLE_CHOICE, MULTI_CHOICE, TRUE_FALSE.
 * Ответ ученика — массив выбранных optionId. OPEN_TEXT (LLM-проверка) — отдельно (S4.1 ext).
 */

export type GradableType = "SINGLE_CHOICE" | "MULTI_CHOICE" | "TRUE_FALSE";

export interface OptionLike {
  id: string;
  isCorrect: boolean;
}

export interface QuestionLike {
  id: string;
  type: GradableType;
  points: number;
  options: OptionLike[];
}

/**
 * Оценка одного вопроса. Возвращает корректность и начисленные баллы.
 * Правила:
 *  - SINGLE_CHOICE / TRUE_FALSE: ровно один выбранный, и он правильный;
 *  - MULTI_CHOICE: выбраны ВСЕ правильные и НИ ОДНОГО неправильного (всё-или-ничего).
 */
export function gradeQuestion(
  question: QuestionLike,
  selectedOptionIds: string[],
): { correct: boolean; points: number } {
  const selected = new Set(selectedOptionIds);
  const correctIds = question.options.filter((o) => o.isCorrect).map((o) => o.id);
  const correctSet = new Set(correctIds);

  let correct: boolean;
  if (question.type === "MULTI_CHOICE") {
    // все правильные выбраны и нет лишних
    correct =
      selected.size === correctSet.size &&
      [...correctSet].every((id) => selected.has(id));
  } else {
    // SINGLE_CHOICE / TRUE_FALSE: ровно один выбран и он верный
    correct = selected.size === 1 && correctSet.has([...selected][0]!);
  }

  return { correct, points: correct ? question.points : 0 };
}

export interface AttemptResult {
  totalPoints: number;
  earnedPoints: number;
  scorePct: number; // 0–100, округлён
  passed: boolean;
  perQuestion: { questionId: string; correct: boolean; points: number }[];
}

/**
 * Оценка попытки целиком. answers — map questionId → выбранные optionId.
 * passScore — порог в процентах (Quiz.passScore).
 */
export function scoreAttempt(
  questions: QuestionLike[],
  answers: Record<string, string[]>,
  passScore: number,
): AttemptResult {
  const perQuestion = questions.map((q) => {
    const sel = answers[q.id] ?? [];
    const { correct, points } = gradeQuestion(q, sel);
    return { questionId: q.id, correct, points };
  });

  const totalPoints = questions.reduce((s, q) => s + q.points, 0);
  const earnedPoints = perQuestion.reduce((s, r) => s + r.points, 0);
  const scorePct = totalPoints === 0 ? 0 : Math.round((earnedPoints / totalPoints) * 100);

  return {
    totalPoints,
    earnedPoints,
    scorePct,
    passed: scorePct >= passScore,
    perQuestion,
  };
}
