"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { CheckCircle2, XCircle, ChevronLeft, ChevronRight, RotateCcw, Award } from "lucide-react";
import { submitQuizAttempt } from "./actions";
import { Button } from "@/components/ui/button";

export interface RunnerQuestion {
  id: string;
  type: "SINGLE_CHOICE" | "MULTI_CHOICE" | "TRUE_FALSE";
  text: string;
  options: { id: string; text: string }[];
}

interface ReviewItem {
  questionId: string;
  correct: boolean;
  explanation: string | null;
  correctOptionIds: string[];
}

interface Result {
  scorePct: number;
  passed: boolean;
  passScore: number;
  certificateIssued: boolean;
  review: ReviewItem[];
}

export function QuizRunner({
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
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const noAttempts = attemptsLeft != null && attemptsLeft <= 0;

  const toggle = (qId: string, optId: string, multi: boolean) => {
    setAnswers((prev) => {
      const cur = prev[qId] ?? [];
      if (multi) {
        return { ...prev, [qId]: cur.includes(optId) ? cur.filter((x) => x !== optId) : [...cur, optId] };
      }
      return { ...prev, [qId]: [optId] };
    });
  };

  async function submit() {
    setPending(true);
    setError(null);
    const res = await submitQuizAttempt({ quizId, answers });
    setPending(false);
    if (res.ok) setResult(res.data);
    else setError(res.error);
  }

  function reset() {
    setAnswers({});
    setIdx(0);
    setResult(null);
    setError(null);
  }

  // ── Экран результата ────────────────────────────────────────────────────
  if (result) {
    const correctCount = result.review.filter((r) => r.correct).length;
    return (
      <div>
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className={[
            "rounded-2xl border p-6 text-center",
            result.passed
              ? "border-emerald-600/30 bg-emerald-500/5"
              : "border-amber-600/30 bg-amber-500/5",
          ].join(" ")}
        >
          <p className="text-4xl font-bold">{result.scorePct}%</p>
          <p className={["mt-2 text-lg font-semibold", result.passed ? "text-emerald-700" : "text-amber-700"].join(" ")}>
            {result.passed ? "Тест сдан!" : "Тест не сдан"}
          </p>
          <p className="mt-1 text-sm text-foreground/60">
            Правильных ответов: {correctCount} из {result.review.length} · проходной {result.passScore}%
          </p>
        </motion.div>

        {result.certificateIssued ? (
          <Link
            href="/app/certificates"
            className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 font-semibold text-amber-800 transition-colors hover:bg-amber-500/10"
          >
            <Award className="size-5" />
            Сертификат сформирован — открыть
          </Link>
        ) : null}

        {/* Разбор */}
        <div className="mt-6 space-y-3">
          {questions.map((q, i) => {
            const r = result.review.find((x) => x.questionId === q.id);
            const sel = answers[q.id] ?? [];
            return (
              <div key={q.id} className="rounded-xl border border-foreground/10 p-4">
                <div className="flex items-start gap-2">
                  {r?.correct ? (
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                  ) : (
                    <XCircle className="mt-0.5 size-5 shrink-0 text-red-500" />
                  )}
                  <p className="font-medium">
                    {i + 1}. {q.text}
                  </p>
                </div>
                <ul className="mt-2 space-y-1 pl-7 text-sm">
                  {q.options.map((o) => {
                    const isCorrect = r?.correctOptionIds.includes(o.id);
                    const isSelected = sel.includes(o.id);
                    return (
                      <li
                        key={o.id}
                        className={[
                          isCorrect ? "font-medium text-emerald-700" : "",
                          isSelected && !isCorrect ? "text-red-600 line-through" : "",
                          !isCorrect && !isSelected ? "text-foreground/50" : "",
                        ].join(" ")}
                      >
                        {isCorrect ? "✓ " : isSelected ? "✗ " : "• "}
                        {o.text}
                      </li>
                    );
                  })}
                </ul>
                {r?.explanation ? (
                  <p className="mt-2 rounded-lg bg-foreground/[0.03] px-3 py-2 pl-7 text-sm text-foreground/70">
                    {r.explanation}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        {!result.passed && !noAttempts ? (
          <Button onClick={reset} variant="accent" size="lg" className="mt-6">
            <RotateCcw className="size-4" />
            Пройти заново
          </Button>
        ) : null}
      </div>
    );
  }

  // ── Прохождение по одному вопросу ─────────────────────────────────────────
  if (questions.length === 0) {
    return <p className="text-foreground/50">В тесте пока нет вопросов.</p>;
  }

  if (noAttempts) {
    return (
      <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-6 text-center text-foreground/60">
        Вы исчерпали лимит попыток для этого теста.
      </div>
    );
  }

  const q = questions[idx]!;
  const multi = q.type === "MULTI_CHOICE";
  const sel = answers[q.id] ?? [];
  const isLast = idx === questions.length - 1;
  const allAnswered = questions.every((qq) => (answers[qq.id]?.length ?? 0) > 0);

  return (
    <div>
      {alreadyPassed ? (
        <p className="mb-4 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
          Вы уже сдали этот тест. Можно пройти повторно для тренировки.
        </p>
      ) : null}

      <div className="flex items-center justify-between text-sm text-foreground/50">
        <span>Вопрос {idx + 1} из {questions.length}</span>
        <span>{sel.length > 0 ? "Отвечено" : "Выберите ответ"}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/10">
        <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${((idx + 1) / questions.length) * 100}%` }} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={q.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="mt-5"
        >
          <p className="text-lg font-medium">{q.text}</p>
          {multi ? <p className="mt-1 text-xs text-foreground/50">Выберите все подходящие варианты</p> : null}

          <div className="mt-4 space-y-2">
            {q.options.map((o) => {
              const checked = sel.includes(o.id);
              return (
                <label
                  key={o.id}
                  className={[
                    "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors",
                    checked ? "border-amber-500 bg-amber-500/5" : "border-foreground/15 hover:bg-foreground/[0.02]",
                  ].join(" ")}
                >
                  <input
                    type={multi ? "checkbox" : "radio"}
                    name={q.id}
                    checked={checked}
                    onChange={() => toggle(q.id, o.id, multi)}
                    className="size-4 accent-amber-500"
                  />
                  <span>{o.text}</span>
                </label>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      <div className="mt-6 flex items-center justify-between">
        <Button variant="outline" size="sm" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>
          <ChevronLeft className="size-4" />
          Назад
        </Button>
        {isLast ? (
          <Button variant="accent" disabled={!allAnswered || pending} onClick={submit}>
            {pending ? "Проверяем…" : "Завершить тест"}
          </Button>
        ) : (
          <Button variant="accent" size="sm" disabled={sel.length === 0} onClick={() => setIdx((i) => i + 1)}>
            Далее
            <ChevronRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
