"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Check, X, Trophy, RefreshCw, Timer, Flame } from "lucide-react";
import type { ObjectionsData } from "@/lib/interactive";
import { scoreAnswer, comboMultiplier, RAPID_QUESTION_MS } from "@/lib/learn/rapidfire";

/**
 * Тренажёр «возражения на скорость» (rapid-fire): то же содержание, что у
 * ObjectionTrainer, но под таймером — очки за скорость и серию верных ответов.
 * Тренирует быстрый уверенный ответ под давлением. Клиентский, без записи на сервер.
 */

type Phase = "intro" | "playing" | "feedback" | "done";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

const TICK_MS = 50;
const RADIUS = 26;
const CIRC = 2 * Math.PI * RADIUS;

export function RapidFireDrill({ data }: { data: ObjectionsData }) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [order, setOrder] = useState(() => shuffle(data.items));
  const [index, setIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(RAPID_QUESTION_MS);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [gained, setGained] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [shake, setShake] = useState(false);
  const deadline = useRef(0);

  const item = order[index];
  const total = order.length;

  const resolve = useCallback(
    (choice: number | null, remainingMs: number) => {
      if (!item) return;
      const correct = choice !== null && !!item.options[choice]?.correct;
      const newStreak = correct ? streak + 1 : 0;
      const pts = scoreAnswer(correct, remainingMs, newStreak);
      setPicked(choice);
      setScore((s) => s + pts);
      setGained(pts);
      setStreak(newStreak);
      setMaxStreak((m) => Math.max(m, newStreak));
      if (correct) setCorrectCount((c) => c + 1);
      else {
        setShake(true);
        setTimeout(() => setShake(false), 400);
      }
      setPhase("feedback");
    },
    [item, streak],
  );

  // Таймер обратного отсчёта на активной фазе.
  useEffect(() => {
    if (phase !== "playing") return;
    deadline.current = Date.now() + RAPID_QUESTION_MS;
    setTimeLeft(RAPID_QUESTION_MS);
    const id = setInterval(() => {
      const left = deadline.current - Date.now();
      if (left <= 0) {
        clearInterval(id);
        resolve(null, 0); // таймаут — как неверный ответ
      } else {
        setTimeLeft(left);
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [phase, index, resolve]);

  const start = () => {
    setOrder(shuffle(data.items));
    setIndex(0);
    setScore(0);
    setStreak(0);
    setMaxStreak(0);
    setCorrectCount(0);
    setPicked(null);
    setPhase("playing");
  };

  const next = () => {
    if (index < total - 1) {
      setIndex((i) => i + 1);
      setPicked(null);
      setPhase("playing");
    } else {
      setPhase("done");
    }
  };

  // ─── Экран старта ───
  if (phase === "intro") {
    return (
      <div className="rounded-2xl border border-foreground/10 bg-background p-8 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600">
          <Zap className="size-7" />
        </div>
        <p className="mt-3 text-lg font-bold">Возражения на скорость</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-foreground/60">
          {total} возражений, по {RAPID_QUESTION_MS / 1000} секунд на каждое. Очки — за скорость и серию
          верных ответов подряд. Готовы?
        </p>
        <button
          onClick={start}
          className="mx-auto mt-5 inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
        >
          <Zap className="size-4" />
          Старт
        </button>
      </div>
    );
  }

  // ─── Итог ───
  if (phase === "done") {
    const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-8 text-center">
        <Trophy className="mx-auto size-10 text-amber-500" />
        <p className="mt-3 text-3xl font-extrabold tabular-nums">{score}</p>
        <p className="text-sm text-foreground/55">очков</p>
        <div className="mx-auto mt-4 flex max-w-xs justify-center gap-6 text-sm">
          <div>
            <p className="font-bold text-emerald-600">{accuracy}%</p>
            <p className="text-xs text-foreground/50">точность</p>
          </div>
          <div>
            <p className="flex items-center justify-center gap-1 font-bold text-amber-600">
              <Flame className="size-4" />
              {maxStreak}
            </p>
            <p className="text-xs text-foreground/50">макс. серия</p>
          </div>
          <div>
            <p className="font-bold">
              {correctCount}/{total}
            </p>
            <p className="text-xs text-foreground/50">верных</p>
          </div>
        </div>
        <button
          onClick={start}
          className="mx-auto mt-5 inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
        >
          <RefreshCw className="size-4" />
          Ещё раз
        </button>
      </div>
    );
  }

  if (!item) return null;

  const answered = phase === "feedback";
  const ratio = timeLeft / RAPID_QUESTION_MS;
  const ringColor = ratio > 0.5 ? "text-emerald-500" : ratio > 0.25 ? "text-amber-500" : "text-rose-500";

  return (
    <motion.div
      animate={shake ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-foreground/10 bg-background p-4 sm:p-5"
    >
      {/* Шапка: прогресс · таймер-кольцо · счёт/комбо */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-foreground/55">
          {index + 1} / {total}
        </span>

        <div className="relative flex size-16 items-center justify-center">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r={RADIUS} className="fill-none stroke-foreground/10" strokeWidth="5" />
            <circle
              cx="32"
              cy="32"
              r={RADIUS}
              className={`fill-none ${ringColor} transition-colors`}
              strokeWidth="5"
              strokeLinecap="round"
              stroke="currentColor"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - (answered ? 0 : ratio))}
              style={{ transition: answered ? "none" : "stroke-dashoffset 50ms linear" }}
            />
          </svg>
          <Timer className={`size-5 ${ringColor}`} />
        </div>

        <div className="text-right">
          <p className="text-sm font-bold tabular-nums">{score}</p>
          <AnimatePresence>
            {streak >= 2 ? (
              <motion.p
                key={streak}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center justify-end gap-0.5 text-xs font-semibold text-amber-600"
              >
                <Flame className="size-3" />×{comboMultiplier(streak)} серия {streak}
              </motion.p>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      {/* Возражение */}
      <div className="mt-3 rounded-2xl border border-rose-500/25 bg-rose-500/[0.06] p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-rose-600">Возражение</p>
        <p className="mt-0.5 font-semibold">«{item.objection}»</p>
      </div>

      {/* Варианты */}
      <div className="mt-3 space-y-2">
        {item.options.map((o, i) => {
          const isPicked = picked === i;
          const reveal = answered && (o.correct || isPicked);
          return (
            <button
              key={i}
              onClick={() => phase === "playing" && resolve(i, deadline.current - Date.now())}
              disabled={answered}
              className={[
                "flex w-full items-start gap-2.5 rounded-xl border p-3 text-left text-sm transition-colors",
                !answered ? "border-foreground/15 hover:border-amber-500/40 hover:bg-amber-500/[0.05]" : "",
                reveal && o.correct ? "border-emerald-500/40 bg-emerald-500/[0.08]" : "",
                reveal && !o.correct ? "border-rose-500/40 bg-rose-500/[0.07]" : "",
                answered && !reveal ? "border-foreground/10 opacity-55" : "",
              ].join(" ")}
            >
              {reveal ? (
                o.correct ? (
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                ) : (
                  <X className="mt-0.5 size-4 shrink-0 text-rose-600" />
                )
              ) : (
                <span className="mt-0.5 size-4 shrink-0 rounded-full border border-foreground/30" />
              )}
              <span className="min-w-0">{o.text}</span>
            </button>
          );
        })}
      </div>

      {/* Фидбек + далее */}
      {answered ? (
        <div className="mt-3">
          <p className={`text-sm font-semibold ${gained > 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {gained > 0 ? `+${gained} очков` : picked === null ? "Время вышло!" : "Мимо — серия сброшена"}
          </p>
          <button
            onClick={next}
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
          >
            {index < total - 1 ? "Дальше" : "Итог"}
          </button>
        </div>
      ) : null}
    </motion.div>
  );
}
