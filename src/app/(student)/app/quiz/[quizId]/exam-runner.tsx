"use client";

import { submitQuizAttempt } from "./actions";
import { QuizRunner } from "@/components/quiz/quiz-runner";
import type { RunnerQuestion } from "@/components/quiz/types";

/**
 * Обёртка движка заданий под конкретный тест: связывает универсальный QuizRunner
 * с серверным действием оценки submitQuizAttempt.
 */
export function ExamRunner({
  quizId,
  questions,
  alreadyPassed,
  attemptsLeft,
}: {
  quizId: string;
  questions: RunnerQuestion[];
  alreadyPassed: boolean;
  attemptsLeft: number | null;
}) {
  return (
    <QuizRunner
      questions={questions}
      alreadyPassed={alreadyPassed}
      attemptsLeft={attemptsLeft}
      onSubmit={async (answers) => {
        const res = await submitQuizAttempt({ quizId, answers });
        if (!res.ok) throw new Error(res.error);
        return res.data;
      }}
    />
  );
}
