/**
 * Оценка ответов на тест (S4.1 + расширенный движок). Чистая логика без БД —
 * юнит-тестируема. Правильные ответы НИКОГДА не уходят на клиент: оценка только
 * на сервере через эти функции.
 *
 * Типы заданий:
 *  - SINGLE_CHOICE / TRUE_FALSE — один правильный вариант;
 *  - MULTI_CHOICE — все правильные и ни одного лишнего (всё-или-ничего);
 *  - ORDERING — расставить варианты в правильном порядке (по option.sortOrder);
 *  - FILL_BLANK — вписать пропущенные слова (сверка с правильными по нормализации).
 */

export type GradableType =
  | "SINGLE_CHOICE"
  | "MULTI_CHOICE"
  | "TRUE_FALSE"
  | "ORDERING"
  | "FILL_BLANK"
  | "MATCHING"
  | "CATEGORIZATION";

export interface OptionLike {
  id: string;
  isCorrect: boolean;
  sortOrder?: number; // ORDERING: правильная позиция; FILL_BLANK/MATCHING/CATEGORIZATION: порядок элемента
  text?: string; // FILL_BLANK: эталонный ответ; MATCHING/CATEGORIZATION: левый элемент
  pairKey?: string | null; // MATCHING: правый элемент пары; CATEGORIZATION: правильная категория
}

export interface QuestionLike {
  id: string;
  type: GradableType;
  points: number;
  options: OptionLike[];
}

/** Нормализация ответа FILL_BLANK: регистр, пробелы, пунктуация, ё→е. */
export function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[.,!?;:"'«»()-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Оценка одного вопроса. `answer` — для choice/ordering это массив optionId
 * (для ORDERING — в порядке, выбранном учеником), для FILL_BLANK — массив строк.
 */
export function gradeQuestion(
  question: QuestionLike,
  answer: string[],
): { correct: boolean; points: number } {
  let correct: boolean;

  switch (question.type) {
    case "MULTI_CHOICE": {
      const selected = new Set(answer);
      const correctIds = question.options.filter((o) => o.isCorrect).map((o) => o.id);
      correct =
        selected.size === correctIds.length && correctIds.every((id) => selected.has(id));
      break;
    }
    case "ORDERING": {
      // answer — optionId в порядке ученика; правильно, если позиция совпадает с sortOrder
      const ordered = [...question.options].sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
      );
      correct =
        answer.length === ordered.length &&
        ordered.every((opt, i) => answer[i] === opt.id);
      break;
    }
    case "FILL_BLANK": {
      // answer — введённые строки по порядку пропусков; сверка с эталонами
      const blanks = [...question.options].sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
      );
      correct =
        answer.length === blanks.length &&
        blanks.every((b, i) => normalizeAnswer(answer[i] ?? "") === normalizeAnswer(b.text ?? ""));
      break;
    }
    case "MATCHING":
    case "CATEGORIZATION": {
      // answer — выбранный правый/категория для каждого левого элемента (по порядку).
      // Сверка нормализованная: answer[i] соответствует pairKey элемента i.
      const items = [...question.options].sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
      );
      correct =
        answer.length === items.length &&
        items.every((it, i) => normalizeAnswer(answer[i] ?? "") === normalizeAnswer(it.pairKey ?? ""));
      break;
    }
    default: {
      // SINGLE_CHOICE / TRUE_FALSE — ровно один выбран и он верный
      const selected = new Set(answer);
      const correctIds = new Set(question.options.filter((o) => o.isCorrect).map((o) => o.id));
      correct = selected.size === 1 && correctIds.has([...selected][0]!);
    }
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
 * Оценка попытки целиком. answers — map questionId → ответ (массив optionId/строк).
 * passScore — порог в процентах (Quiz.passScore).
 */
export function scoreAttempt(
  questions: QuestionLike[],
  answers: Record<string, string[]>,
  passScore: number,
): AttemptResult {
  const perQuestion = questions.map((q) => {
    const ans = answers[q.id] ?? [];
    const { correct, points } = gradeQuestion(q, ans);
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
