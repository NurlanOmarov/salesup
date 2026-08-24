"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PartyPopper, RotateCcw, XCircle } from "lucide-react";
import type { ObjectionScaleData, ScaleOption } from "@/lib/interactive";

/**
 * Игра «весы возражения» (S: bespoke). На каждый раунд — реплика клиента и пул
 * вариантов ответа. Оправдание клонит чашу влево и выбывает из пула; позитивный
 * конструктивный ответ клонит чашу вправо и закрывает раунд. Два оправдания
 * подряд в одном раунде — клиент «уходит», раунд начинается заново с тем же
 * пулом (без потери прогресса по остальным раундам). Учит: не оправдывайся,
 * отвечай позитивно — механика прямо наказывает оправдания наклоном чаши.
 */
export function ObjectionScale({ data }: { data: ObjectionScaleData }) {
  const [roundIdx, setRoundIdx] = useState(0);
  const round = data.rounds[roundIdx];

  const [disabled, setDisabled] = useState<Set<number>>(new Set());
  const [misses, setMisses] = useState(0);
  const [tilt, setTilt] = useState(0); // -2..2, отрицательное = влево (оправдание)
  const [feedback, setFeedback] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [won, setWon] = useState(false);
  const [left, setLeft] = useState(false); // клиент ушёл — раунд провален

  function resetRoundState() {
    setDisabled(new Set());
    setMisses(0);
    setTilt(0);
    setFeedback(null);
    setWon(false);
    setLeft(false);
  }

  function pick(opt: ScaleOption, i: number) {
    if (disabled.has(i) || won || left) return;
    if (opt.positive) {
      setTilt(2);
      setFeedback({ tone: "good", text: opt.feedback });
      setWon(true);
      return;
    }
    const nextMisses = misses + 1;
    setMisses(nextMisses);
    setDisabled((p) => new Set(p).add(i));
    setTilt(-Math.min(2, nextMisses));
    setFeedback({ tone: "bad", text: opt.feedback });
    if (nextMisses >= 2) {
      setLeft(true);
    }
  }

  function nextRound() {
    resetRoundState();
    setRoundIdx((r) => Math.min(data.rounds.length - 1, r + 1));
  }

  function retryRound() {
    resetRoundState();
  }

  const isLastRound = roundIdx >= data.rounds.length - 1;
  const allDone = won && isLastRound;

  if (!round) return null;

  return (
    <div className="rounded-2xl border border-foreground/10 bg-background p-5 sm:p-6">
      {data.title ? <h3 className="font-bold">{data.title}</h3> : null}
      {data.prompt ? <p className="mt-1 text-sm text-foreground/65">{data.prompt}</p> : null}

      <p className="mt-3 text-xs font-medium text-foreground/45">
        Раунд {roundIdx + 1} из {data.rounds.length}
      </p>

      <div className="mt-4 grid gap-6 sm:grid-cols-[auto_1fr] sm:items-start">
        <Scale tilt={tilt} />

        <div className="min-w-0">
          <p className="rounded-xl bg-foreground/[0.04] p-3 text-sm font-semibold">«{round.objection}»</p>

          {!won && !left ? (
            <div className="mt-3 grid gap-2">
              {round.options.map((opt, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={disabled.has(i)}
                  onClick={() => pick(opt, i)}
                  className={`rounded-lg border px-3.5 py-2 text-left text-sm font-medium transition-colors ${
                    disabled.has(i)
                      ? "border-foreground/10 bg-foreground/[0.03] text-foreground/35 line-through"
                      : "border-foreground/15 hover:border-brand/40"
                  }`}
                >
                  {opt.text}
                </button>
              ))}
            </div>
          ) : null}

          <AnimatePresence mode="wait">
            {feedback && !left ? (
              <motion.p
                key={feedback.text}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`mt-3 rounded-xl border px-4 py-2.5 text-sm font-medium ${
                  feedback.tone === "good"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-800"
                }`}
              >
                {feedback.text}
              </motion.p>
            ) : null}
          </AnimatePresence>

          {left ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-700"
            >
              <XCircle className="size-4 shrink-0" />
              Два оправдания подряд — клиент разворачивается и уходит. Попробуйте раунд ещё раз.
            </motion.div>
          ) : null}

          {won ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700"
            >
              <PartyPopper className="size-4 shrink-0" />
              {allDone ? "Все возражения отработаны позитивом — раунды пройдены!" : "Возражение снято позитивным ответом."}
            </motion.div>
          ) : null}

          <div className="mt-4 flex items-center gap-3">
            {left ? (
              <button
                type="button"
                onClick={retryRound}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                <RotateCcw className="size-3.5" />
                Начать раунд заново
              </button>
            ) : null}
            {won && !isLastRound ? (
              <button
                type="button"
                onClick={nextRound}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                Следующее возражение →
              </button>
            ) : null}
            {allDone ? (
              <button
                type="button"
                onClick={() => {
                  setRoundIdx(0);
                  resetRoundState();
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground/50 transition-colors hover:text-foreground/80"
              >
                <RotateCcw className="size-3.5" />
                Пройти снова
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function Scale({ tilt }: { tilt: number }) {
  // tilt: -2..2 (отрицательное — влево к «оправданию», положительное — вправо к «позитиву»)
  const angle = tilt * 9;
  return (
    <svg viewBox="0 0 200 140" className="h-32 w-40 shrink-0 justify-self-center sm:h-36 sm:w-44" role="img" aria-label="Весы возражения">
      {/* стойка */}
      <rect x="96" y="20" width="8" height="90" rx="3" className="fill-foreground/20" />
      <rect x="70" y="106" width="60" height="10" rx="4" className="fill-foreground/20" />

      <motion.g
        initial={false}
        animate={{ rotate: angle }}
        transition={{ type: "spring", stiffness: 160, damping: 16 }}
        style={{ originX: "100px", originY: "30px" }}
      >
        <rect x="20" y="27" width="160" height="4" className="fill-foreground/30" />
        {/* нити подвеса — поворачиваются вместе с коромыслом, как в реальных весах */}
        <line x1="30" y1="29" x2="30" y2="60" className="stroke-red-400/60" strokeWidth="2" />
        <line x1="170" y1="29" x2="170" y2="60" className="stroke-emerald-400/60" strokeWidth="2" />

        {/* левая чаша — «оправдание». Встречный поворот: чаша висит на нити свободно и остаётся горизонтальной. */}
        <motion.g
          initial={false}
          animate={{ rotate: -angle }}
          transition={{ type: "spring", stiffness: 160, damping: 16 }}
          style={{ originX: "30px", originY: "60px" }}
        >
          <path d="M12 60 h36 a18 10 0 0 1 -36 0 z" className="fill-red-500/20 stroke-red-400/50" strokeWidth="1.5" />
          <text x="30" y="78" textAnchor="middle" className="fill-red-600 text-[9px] font-semibold">
            оправдание
          </text>
        </motion.g>

        {/* правая чаша — «позитив», тот же встречный поворот */}
        <motion.g
          initial={false}
          animate={{ rotate: -angle }}
          transition={{ type: "spring", stiffness: 160, damping: 16 }}
          style={{ originX: "170px", originY: "60px" }}
        >
          <path d="M152 60 h36 a18 10 0 0 1 -36 0 z" className="fill-emerald-500/20 stroke-emerald-400/50" strokeWidth="1.5" />
          <text x="170" y="78" textAnchor="middle" className="fill-emerald-700 text-[9px] font-semibold">
            позитив
          </text>
        </motion.g>
      </motion.g>

      <circle cx="100" cy="30" r="5" className="fill-foreground/40" />
    </svg>
  );
}
