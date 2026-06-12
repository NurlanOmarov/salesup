import type { QuestionKind, QuestionTypeDef } from "./types";
import { ChoiceInput, ChoiceReview } from "./inputs/choice-input";
import { OrderingInput, OrderingReview } from "./inputs/ordering-input";
import { FillBlankInput, FillBlankReview } from "./inputs/fill-blank-input";
import { MatchingInput, MatchingReview } from "./inputs/matching-input";
import { CategorizationInput, CategorizationReview } from "./inputs/categorization-input";
import { PracticeInput, PracticeReview } from "./inputs/practice-input";
import { ScenarioInput, ScenarioReview } from "./inputs/scenario-input";

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
  MATCHING: {
    Input: MatchingInput,
    Review: MatchingReview,
    isAnswered: (a, q) => q.options.every((_, i) => (a[i] ?? "").length > 0),
    hint: "Сопоставьте элементы слева с вариантами справа",
  },
  CATEGORIZATION: {
    Input: CategorizationInput,
    Review: CategorizationReview,
    isAnswered: (a, q) => q.options.every((_, i) => (a[i] ?? "").length > 0),
    hint: "Распределите элементы по категориям",
  },
  PRACTICE: {
    Input: PracticeInput,
    Review: PracticeReview,
    isAnswered: (a) => (a[0] ?? "").trim().length >= 10,
    hint: "Выполните упражнение и сверьтесь с эталоном",
  },
  SCENARIO: {
    Input: ScenarioInput,
    Review: ScenarioReview,
    isAnswered: (a) => a.length === 1,
  },
};
