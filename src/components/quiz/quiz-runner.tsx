"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { CheckCircle2, XCircle, ChevronLeft, ChevronRight, RotateCcw, Award, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QUESTION_TYPES } from "./registry";
import type { RunnerQuestion, QuestionReview } from "./types";

/**
 * Универсальный раннер заданий (расширяемый движок): один вопрос на экран,
 * рендер ввода/разбора через реестр типов, богатые анимации (slide-переходы,
 * конфетти при успехе, счётчик XP). Правильные ответы приходят только после сдачи.
 */

interface Result {
  scorePct: number;
  passed: boolean;
  passScore: number;
  certificateIssued?: boolean;
  xpEarned?: number;
  review: QuestionReview[];
}

export interface QuizRunnerProps {
  questions: RunnerQuestion[];
  alreadyPassed: boolean;
  attemptsLeft: number | null;
  onSubmit: (answers: Record<string, string[]>) => Promise<Result>;
  /** XP за один правильный ответ (для анимации). */
  xpPerQuestion?: number;
}

export function QuizRunner({
  questions,
  alreadyPassed,
  attemptsLeft,
  onSubmit,
  xpPerQuestion = 10,
}: QuizRunnerProps) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const noAttempts = attemptsLeft != null && attemptsLeft <= 0;

  const setAnswer = useCallback((qId: string, value: string[]) => {
    setAnswers((prev) => ({ ...prev, [qId]: value }));
  }, []);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const r = await onSubmit(answers);
      setResult(r);
      if (r.passed) {
        void confetti({ particleCount: 140, spread: 75, origin: { y: 0.6 }, colors: ["#f59e0b", "#10b981", "#6366f1"] });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось проверить");
    } finally {
      setPending(false);
    }
  }

  function reset() {
    setAnswers({});
    setIdx(0);
    setResult(null);
    setError(null);
  }

  if (result) {
    return <ResultScreen result={result} questions={questions} answers={answers} onReset={reset} canRetry={!noAttempts} xpPerQuestion={xpPerQuestion} />;
  }

  if (questions.length === 0) return <p className="text-foreground/50">В задании пока нет вопросов.</p>;
  if (noAttempts) {
    return (
      <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-6 text-center text-foreground/60">
        Вы исчерпали лимит попыток для этого задания.
      </div>
    );
  }

  const q = questions[idx]!;
  const def = QUESTION_TYPES[q.type];
  const answer = answers[q.id] ?? [];
  const answered = def.isAnswered(answer, q);
  const isLast = idx === questions.length - 1;
  const allAnswered = questions.every((qq) => QUESTION_TYPES[qq.type].isAnswered(answers[qq.id] ?? [], qq));
  const InputComp = def.Input;

  return (
    <div>
      {alreadyPassed ? (
        <p className="mb-4 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
          Вы уже прошли это задание. Можно повторить для тренировки.
        </p>
      ) : null}

      <div className="flex items-center justify-between text-sm text-foreground/50">
        <span>Вопрос {idx + 1} из {questions.length}</span>
        <span>{answered ? "Готово" : "Ответьте"}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/10">
        <motion.div
          className="h-full rounded-full bg-amber-500"
          initial={false}
          animate={{ width: `${((idx + 1) / questions.length) * 100}%` }}
          transition={{ type: "spring", stiffness: 200, damping: 30 }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={q.id}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.22 }}
          className="mt-5"
        >
          <p className="text-lg font-medium">{q.text}</p>
          {def.hint ? <p className="mt-1 text-xs text-foreground/50">{def.hint}</p> : null}
          <div className="mt-4">
            <InputComp question={q} answer={answer} onChange={(v) => setAnswer(q.id, v)} />
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
            {pending ? "Проверяем…" : "Завершить"}
          </Button>
        ) : (
          <Button variant="accent" size="sm" disabled={!answered} onClick={() => setIdx((i) => i + 1)}>
            Далее
            <ChevronRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function ResultScreen({
  result,
  questions,
  answers,
  onReset,
  canRetry,
  xpPerQuestion,
}: {
  result: Result;
  questions: RunnerQuestion[];
  answers: Record<string, string[]>;
  onReset: () => void;
  canRetry: boolean;
  xpPerQuestion: number;
}) {
  const correctCount = result.review.filter((r) => r.correct).length;
  const xp = result.xpEarned ?? correctCount * xpPerQuestion;

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 18 }}
        className={[
          "rounded-2xl border p-6 text-center",
          result.passed ? "border-emerald-600/30 bg-emerald-500/5" : "border-amber-600/30 bg-amber-500/5",
        ].join(" ")}
      >
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 260, damping: 14 }}
          className="mx-auto mb-2 flex size-14 items-center justify-center rounded-full bg-amber-500/15"
        >
          <Trophy className={result.passed ? "size-7 text-amber-500" : "size-7 text-amber-600/60"} />
        </motion.div>
        <CountUp value={result.scorePct} className="text-4xl font-bold" suffix="%" />
        <p className={["mt-1 text-lg font-semibold", result.passed ? "text-emerald-700" : "text-amber-700"].join(" ")}>
          {result.passed ? "Задание пройдено!" : "Почти получилось"}
        </p>
        <p className="mt-1 text-sm text-foreground/60">
          Правильных: {correctCount} из {result.review.length} · проходной {result.passScore}%
        </p>
        {result.passed ? (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-3 py-1 text-sm font-semibold text-amber-700"
          >
            +{xp} XP
          </motion.p>
        ) : null}
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
          if (!r) return null;
          const ReviewComp = QUESTION_TYPES[q.type].Review;
          return (
            <motion.div
              key={q.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-xl border border-foreground/10 p-4"
            >
              <div className="flex items-start gap-2">
                {r.correct ? (
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                ) : (
                  <XCircle className="mt-0.5 size-5 shrink-0 text-red-500" />
                )}
                <p className="font-medium">{i + 1}. {q.text}</p>
              </div>
              <div className="mt-2 pl-7">
                <ReviewComp question={q} answer={answers[q.id] ?? []} review={r} />
                {r.explanation ? (
                  <p className="mt-2 rounded-lg bg-foreground/[0.03] px-3 py-2 text-sm text-foreground/70">{r.explanation}</p>
                ) : null}
              </div>
            </motion.div>
          );
        })}
      </div>

      {!result.passed && canRetry ? (
        <Button onClick={onReset} variant="accent" size="lg" className="mt-6">
          <RotateCcw className="size-4" />
          Пройти заново
        </Button>
      ) : null}
    </div>
  );
}

/** Анимированный счётчик до значения. */
function CountUp({ value, className, suffix = "" }: { value: number; className?: string; suffix?: string }) {
  const [n, setN] = useState(0);
  useState(() => {
    const start = performance.now();
    const dur = 900;
    const tick = (t: number) => {
      const p = Math.min((t - start) / dur, 1);
      setN(Math.round((1 - Math.pow(1 - p, 3)) * value));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  return <p className={className}>{n}{suffix}</p>;
}
