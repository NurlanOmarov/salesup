"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PartyPopper, RotateCcw, ThumbsDown, ThumbsUp } from "lucide-react";
import type { StageLadderData } from "@/lib/interactive";

/**
 * Игра «лестница этапов продажи» (S: bespoke, по образцу metaphor-trainer.tsx).
 * Ученик поднимается по 5 названным ступеням урока. Первые три — клик-повествование
 * («Дальше»). Четвёртая ступень — «реакция клиента»: показываются ДВЕ карточки по
 * очереди — сперва негативная (правильный ход — откат вниз к потребностям), затем
 * позитивная (правильный ход — закрытие наверху). Неверный выбор трясёт текущую
 * ступень и даёт попробовать снова — механика буквально показывает «негативная
 * реакция → возвращаемся к потребностям», а не просто рассказывает об этом.
 */
export function StageLadder({ data }: { data: StageLadderData }) {
  // step: 0..2 — обычные ступени (клик «Дальше»), 3 — «реакция клиента», 4 — закрытие (финал)
  const [step, setStep] = useState(0);
  const [cardIdx, setCardIdx] = useState(0); // 0 — негативная карточка, 1 — позитивная
  const [shake, setShake] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [done, setDone] = useState(false);

  const card = data.reactionCards[cardIdx];

  function next() {
    setFeedback(null);
    setStep((s) => Math.min(3, s + 1));
  }

  function reset() {
    setStep(0);
    setCardIdx(0);
    setShake(false);
    setFeedback(null);
    setDone(false);
  }

  function choose(choiceClose: boolean) {
    if (!card) return;
    const correct = choiceClose === card.positive;
    if (!correct) {
      setShake(true);
      setFeedback({ ok: false, text: card.explanation });
      setTimeout(() => setShake(false), 420);
      return;
    }
    setFeedback({ ok: true, text: card.explanation });
    if (card.positive) {
      // Верно закрыли — финал.
      setStep(4);
      setDone(true);
    } else {
      // Верно откатились к потребностям — визуально спускаемся, затем следующая (позитивная) карточка.
      setStep(1);
      setCardIdx(1);
    }
  }

  return (
    <div className="rounded-2xl border border-foreground/10 bg-background p-5 sm:p-6">
      {data.title ? <h3 className="font-bold">{data.title}</h3> : null}
      {data.prompt ? <p className="mt-1 text-sm text-foreground/65">{data.prompt}</p> : null}

      <div className="mt-5 grid gap-6 sm:grid-cols-[auto_1fr] sm:items-start">
        <Staircase titles={data.stepTitles} step={step} shake={shake} />

        <div className="min-w-0">
          <AnimatePresence mode="wait">
            {step < 3 ? (
              <motion.div
                key={`climb-${step}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="rounded-xl bg-foreground/[0.04] p-4"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-foreground/50">
                  Ступень {step + 1} из 5
                </p>
                <p className="mt-1 font-semibold">{data.stepTitles[step]}</p>
                <button
                  type="button"
                  onClick={next}
                  className="mt-3 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                >
                  Дальше →
                </button>
              </motion.div>
            ) : step === 3 && card ? (
              <motion.div
                key={`react-${cardIdx}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-foreground/50">
                  Ступень 4 из 5 · Реакция клиента
                </p>
                <p className="mt-1.5 font-semibold">«{card.clientLine}»</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => choose(false)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/15 px-3.5 py-2 text-sm font-medium transition-colors hover:border-brand/40"
                  >
                    <ThumbsDown className="size-4 text-foreground/50" />
                    Реакция негативная — вернуться к потребностям
                  </button>
                  <button
                    type="button"
                    onClick={() => choose(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/15 px-3.5 py-2 text-sm font-medium transition-colors hover:border-brand/40"
                  >
                    <ThumbsUp className="size-4 text-foreground/50" />
                    Реакция позитивная — закрыть сделку
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="win"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700"
              >
                <PartyPopper className="size-4 shrink-0" />
                Сделка закрыта — вы поднялись по всем пяти ступеням!
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {feedback ? (
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`mt-3 rounded-xl border px-4 py-2.5 text-sm font-medium ${
                  feedback.ok
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-800"
                }`}
              >
                {feedback.text}
              </motion.p>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      {done ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground/50 transition-colors hover:text-foreground/80"
          >
            <RotateCcw className="size-3.5" />
            Пройти снова
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Staircase({ titles, step, shake }: { titles: string[]; step: number; shake: boolean }) {
  // 5 ступеней снизу вверх; текущая ступень подсвечена, маркер «стоит» на ней.
  const n = titles.length;
  const stepH = 26;
  const stepW = 34;
  const width = 40 + stepW * n;
  const height = 34 + stepH * n;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-40 shrink-0 justify-self-center sm:w-44"
      role="img"
      aria-label="Лестница этапов продажи"
    >
      {titles.map((t, i) => {
        const y = height - 24 - stepH * i;
        const w = 40 + stepW * (i + 1);
        const on = i <= step;
        return (
          <g key={i}>
            <rect
              x={0}
              y={y}
              width={w}
              height={stepH}
              rx={4}
              className={on ? "fill-brand/25" : "fill-foreground/[0.06]"}
            />
            <text
              x={6}
              y={y + stepH / 2 + 4}
              className={`text-[9px] font-medium ${on ? "fill-brand-strong" : "fill-foreground/35"}`}
            >
              {i + 1}. {t.length > 20 ? `${t.slice(0, 19)}…` : t}
            </text>
          </g>
        );
      })}
      {/* маркер игрока */}
      <motion.circle
        cx={16}
        r={9}
        className="fill-brand"
        initial={false}
        animate={{
          cy: height - 24 - stepH * Math.min(step, n - 1) - stepH / 2,
          x: shake ? [0, -4, 4, -3, 0] : 0,
        }}
        transition={{
          cy: { type: "spring", stiffness: 260, damping: 24 },
          x: { duration: 0.4, ease: "easeInOut" },
        }}
      />
    </svg>
  );
}
