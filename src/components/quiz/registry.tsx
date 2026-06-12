import type { QuestionKind, QuestionTypeDef } from "./types";
import { ChoiceInput, ChoiceReview } from "./inputs/choice-input";
import { OrderingInput, OrderingReview } from "./inputs/ordering-input";
import { FillBlankInput, FillBlankReview } from "./inputs/fill-blank-input";

/**
 * Реестр типов заданий (расширяемый движок). Новый тип = добавить запись сюда +
 * компоненты Input/Review. Остальной код (quiz-runner, страница) не меняется.
 * Серверная оценка типов — в lib/quiz/scoring (gradeQuestion).
 */
export const QUESTION_TYPES: Record<QuestionKind, QuestionTypeDef> = {
  SINGLE_CHOICE: {
    Input: ChoiceInput,
    Review: ChoiceReview,
    isAnswered: (a) => a.length === 1,
  },
  TRUE_FALSE: {
    Input: ChoiceInput,
    Review: ChoiceReview,
    isAnswered: (a) => a.length === 1,
  },
  MULTI_CHOICE: {
    Input: ChoiceInput,
    Review: ChoiceReview,
    isAnswered: (a) => a.length >= 1,
    hint: "Выберите все подходящие варианты",
  },
  ORDERING: {
    Input: OrderingInput,
    Review: OrderingReview,
    isAnswered: (a, q) => a.length === q.options.length,
    hint: "Перетащите варианты в правильном порядке",
  },
  FILL_BLANK: {
    Input: FillBlankInput,
    Review: FillBlankReview,
    isAnswered: (a, q) => q.options.every((_, i) => (a[i] ?? "").trim().length > 0),
    hint: "Впишите пропущенные слова",
  },
};
