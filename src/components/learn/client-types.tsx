"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Lightbulb, ChevronRight, RefreshCw, Trophy, Quote } from "lucide-react";
import type { ClientTypeKey, ClientTypesData } from "@/lib/interactive";

/**
 * Тренажёр типологии клиента (AiArtifact CLIENT_TYPES).
 *
 * Механика повторяет логику урока, а не проверяет память: сначала по реплике
 * определяем тип (фигура и цвет — тот же язык, что у тренера: круг, квадрат,
 * треугольник, звезда), и только потом выбираем реакцию. Ошибка в типе почти
 * всегда тянет за собой ошибку в реакции — поэтому шкала доверия одна на весь
 * разговор: видно, как накапливается или тратится доверие клиента.
 *
 * Всё локально: ни ответы, ни прогресс на сервер не уходят.
 */

const TYPES: Record<
  ClientTypeKey,
  { label: string; caption: string; color: string; ring: string; shape: "circle" | "square" | "triangle" | "star" }
> = {
  green: { label: "Зелёный", caption: "социальное одобрение", color: "#10b981", ring: "emerald", shape: "circle" },
  blue: { label: "Синий", caption: "логика и структура", color: "#3b82f6", ring: "blue", shape: "square" },
  red: { label: "Красный", caption: "доминирование", color: "#ef4444", ring: "red", shape: "triangle" },
  yellow: { label: "Жёлтый", caption: "фантазёр", color: "#f59e0b", ring: "amber", shape: "star" },
};

const ORDER: ClientTypeKey[] = ["green", "blue", "red", "yellow"];

/** Фигура типа: у каждого своя, как в разборе тренера (круг, квадрат, треугольник, звезда). */
function TypeShape({ type, size = 44 }: { type: ClientTypeKey; size?: number }) {
  const { color, shape } = TYPES[type];
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className="shrink-0">
      {shape === "circle" ? <circle cx="24" cy="24" r="17" fill={color} fillOpacity="0.18" stroke={color} strokeWidth="2.5" /> : null}
      {shape === "square" ? (
        <rect x="8" y="8" width="32" height="32" rx="6" fill={color} fillOpacity="0.18" stroke={color} strokeWidth="2.5" />
      ) : null}
      {shape === "triangle" ? (
        <path d="M24 7 L42 39 H6 Z" fill={color} fillOpacity="0.18" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
      ) : null}
      {shape === "star" ? (
        <path
          d="M24 6 L29.5 18.5 L43 20.2 L33 29.4 L35.6 42.6 L24 36 L12.4 42.6 L15 29.4 L5 20.2 L18.5 18.5 Z"
          fill={color}
          fillOpacity="0.18"
          stroke={color}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      ) : null}
    </svg>
  );
}

/** Шкала доверия клиента: одна на весь разговор, меняется после каждого шага. */
function TrustMeter({ value }: { value: number }) {
  const tone = value >= 70 ? "#10b981" : value >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs text-foreground/55">
        <span>Доверие клиента</span>
        <motion.span key={value} initial={{ scale: 1.25 }} animate={{ scale: 1 }} className="font-semibold" style={{ color: tone }}>
          {value} %
        </motion.span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-foreground/10">
        <motion.div
          className="h-full rounded-full"
          style={{ background: tone }}
          initial={false}
          animate={{ width: `${value}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>
    </div>
  );
}

export function ClientTypesTrainer({ data }: { data: ClientTypesData }) {
  const cards = data.cards;
  const total = cards.length;

  const [index, setIndex] = useState(0);
  const [pickedType, setPickedType] = useState<ClientTypeKey | null>(null);
  const [pickedReaction, setPickedReaction] = useState<number | null>(null);
  const [trust, setTrust] = useState(50);
  const [typeHits, setTypeHits] = useState(0);
  const [reactionHits, setReactionHits] = useState(0);
  const [done, setDone] = useState(false);

  const card = cards[index];
  const typeAnswered = pickedType !== null;
  const reactionAnswered = pickedReaction !== null;

  const bump = (delta: number) => setTrust((t) => Math.max(0, Math.min(100, t + delta)));

  const pickType = (key: ClientTypeKey) => {
    if (typeAnswered || !card) return;
    setPickedType(key);
    if (key === card.type) {
      setTypeHits((n) => n + 1);
      bump(12);
    } else {
      bump(-8);
    }
  };

  const pickReaction = (i: number) => {
    if (reactionAnswered || !card) return;
    setPickedReaction(i);
    if (card.reactions[i]?.correct) {
      setReactionHits((n) => n + 1);
      bump(18);
    } else {
      bump(-14);
    }
  };

  const next = () => {
    if (index < total - 1) {
      setIndex(index + 1);
      setPickedType(null);
      setPickedReaction(null);
    } else {
      setDone(true);
    }
  };

  const restart = () => {
    setIndex(0);
    setPickedType(null);
    setPickedReaction(null);
    setTrust(50);
    setTypeHits(0);
    setReactionHits(0);
    setDone(false);
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-foreground/10 bg-background p-8 text-center">
        <Trophy className="mx-auto size-10 text-amber-500" />
        <p className="mt-3 text-lg font-bold">Доверие клиента: {trust} %</p>
        <p className="mt-1 text-sm text-foreground/60">
          Тип угадан {typeHits} из {total}, эффективная реакция выбрана {reactionHits} из {total}.
        </p>
        <p className="mx-auto mt-3 max-w-md text-sm text-foreground/60">
          {trust >= 80
            ? "Вы читаете тип по первой реплике и меняете под него поведение — именно этого добивается тренер."
            : trust >= 50
              ? "Тип вы чаще узнаёте верно, но реакция иногда остаётся «своей». Пересмотрите разбор эффективных реакций."
              : "Стоит вернуться к уроку: сначала скрытый вопрос типа, потом реакция — иначе разговор идёт вашими привычками, а не под клиента."}
        </p>
        <button
          onClick={restart}
          className="mx-auto mt-5 inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
        >
          <RefreshCw className="size-4" />
          Пройти заново
        </button>
      </div>
    );
  }

  if (!card) return null;

  const correctType = TYPES[card.type];

  return (
    <div className="rounded-2xl border border-foreground/10 bg-background p-4 sm:p-5">
      {data.title ? <h3 className="font-bold">{data.title}</h3> : null}
      {data.prompt ? <p className="mt-1 text-sm text-foreground/65">{data.prompt}</p> : null}

      <div className="mt-3 flex items-center justify-between text-sm text-foreground/55">
        <span>
          Реплика {index + 1} из {total}
        </span>
        <span>
          Тип: {typeHits}/{total} · Реакция: {reactionHits}/{total}
        </span>
      </div>
      <TrustMeter value={trust} />

      {/* Реплика клиента */}
      <div className="mt-4 flex gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-foreground/60">
          <Quote className="size-4" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-foreground/50">Турист говорит</p>
          <p className="mt-0.5 font-semibold">«{card.quote}»</p>
        </div>
      </div>

      {/* Шаг 1 — тип */}
      <p className="mt-5 text-sm font-medium text-foreground/70">Шаг 1. Какой это тип?</p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ORDER.map((key) => {
          const t = TYPES[key];
          const isPicked = pickedType === key;
          const isCorrect = key === card.type;
          const reveal = typeAnswered && (isPicked || isCorrect);
          return (
            <motion.button
              key={key}
              type="button"
              onClick={() => pickType(key)}
              disabled={typeAnswered}
              whileHover={typeAnswered ? undefined : { y: -2 }}
              animate={
                typeAnswered && isPicked && !isCorrect
                  ? { x: [0, -6, 6, -4, 4, 0] }
                  : typeAnswered && isCorrect
                    ? { scale: [1, 1.06, 1] }
                    : {}
              }
              transition={{ duration: 0.45 }}
              className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition-colors ${
                reveal
                  ? isCorrect
                    ? "border-emerald-500/60 bg-emerald-500/10"
                    : "border-rose-500/60 bg-rose-500/10"
                  : "border-foreground/12 hover:border-foreground/30"
              } ${typeAnswered ? "cursor-default" : "cursor-pointer"}`}
            >
              <TypeShape type={key} />
              <span className="text-sm font-semibold">{t.label}</span>
              <span className="text-[11px] leading-tight text-foreground/50">{t.caption}</span>
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>
        {typeAnswered ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-3 flex gap-2 rounded-xl border p-3 text-sm ${
              pickedType === card.type
                ? "border-emerald-500/40 bg-emerald-500/[0.07]"
                : "border-rose-500/40 bg-rose-500/[0.07]"
            }`}
          >
            {pickedType === card.type ? (
              <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            ) : (
              <X className="mt-0.5 size-4 shrink-0 text-rose-600" />
            )}
            <p className="text-foreground/80">
              {pickedType === card.type ? "" : `Это ${correctType.label.toLowerCase()}. `}
              {card.hint}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Шаг 2 — реакция */}
      <AnimatePresence>
        {typeAnswered ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-5">
            <p className="text-sm font-medium text-foreground/70">Шаг 2. Что отвечаете?</p>
            <div className="mt-2 space-y-2">
              {card.reactions.map((r, i) => {
                const isPicked = pickedReaction === i;
                const reveal = reactionAnswered && (isPicked || r.correct);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => pickReaction(i)}
                    disabled={reactionAnswered}
                    className={`w-full rounded-xl border p-3 text-left text-sm transition-colors ${
                      reveal
                        ? r.correct
                          ? "border-emerald-500/60 bg-emerald-500/[0.07]"
                          : "border-rose-500/60 bg-rose-500/[0.07]"
                        : "border-foreground/12 hover:border-foreground/30"
                    } ${reactionAnswered ? "cursor-default" : "cursor-pointer"}`}
                  >
                    <span className="flex gap-2">
                      {reveal ? (
                        r.correct ? (
                          <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                        ) : (
                          <X className="mt-0.5 size-4 shrink-0 text-rose-600" />
                        )
                      ) : null}
                      <span>«{r.text}»</span>
                    </span>
                    {reveal ? <span className="mt-2 block text-xs text-foreground/65">{r.feedback}</span> : null}
                  </button>
                );
              })}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {reactionAnswered ? (
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-xs text-foreground/55">
            <Lightbulb className="size-3.5" />
            Тип определяет не тон разговора, а то, что для клиента доказательство.
          </p>
          <button
            onClick={next}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-foreground px-3.5 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            {index < total - 1 ? "Следующая реплика" : "Итог"}
            <ChevronRight className="size-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
