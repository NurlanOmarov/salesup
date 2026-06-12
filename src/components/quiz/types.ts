import type { ComponentType } from "react";

/**
 * Контракт расширяемого движка заданий. Новый тип задания = реализовать
 * QuestionTypeDef и зарегистрировать в registry — остальной код не меняется.
 * Ответ ученика везде — string[] (optionId / введённые строки), что совпадает
 * с серверной оценкой в lib/quiz/scoring (типобезопасно сквозь весь поток).
 */

export type QuestionKind =
  | "SINGLE_CHOICE"
  | "MULTI_CHOICE"
  | "TRUE_FALSE"
  | "ORDERING"
  | "FILL_BLANK"
  | "MATCHING"
  | "CATEGORIZATION";

export interface QuizOption {
  id: string;
  text: string;
}

export interface RunnerQuestion {
  id: string;
  type: QuestionKind;
  text: string;
  options: QuizOption[]; // FILL_BLANK — пропуски; MATCHING/CATEGORIZATION — левые элементы (по порядку)
  // MATCHING — перемешанные правые элементы; CATEGORIZATION — список категорий
  choices?: string[];
}

/** Разбор одного вопроса после сдачи (правильные ответы приходят только теперь). */
export interface QuestionReview {
  questionId: string;
  correct: boolean;
  explanation: string | null;
  correctOptionIds: string[]; // для ORDERING — id в правильном порядке; для FILL_BLANK — пусто
  correctTexts?: string[]; // FILL_BLANK: эталонные ответы по порядку
  correctPairs?: { left: string; right: string }[]; // MATCHING/CATEGORIZATION: правильные соответствия
}

export interface InputProps {
  question: RunnerQuestion;
  answer: string[];
  onChange: (answer: string[]) => void;
}

export interface ReviewProps {
  question: RunnerQuestion;
  answer: string[];
  review: QuestionReview;
}

/** Определение типа задания: ввод, проверка заполненности, разбор, подсказка. */
export interface QuestionTypeDef {
  /** Компонент ввода ответа. */
  Input: ComponentType<InputProps>;
  /** Компонент разбора после сдачи. */
  Review: ComponentType<ReviewProps>;
  /** Заполнен ли ответ (для активации кнопки «Далее»/«Завершить»). */
  isAnswered: (answer: string[], question: RunnerQuestion) => boolean;
  /** Короткая инструкция под вопросом (опционально). */
  hint?: string;
}
