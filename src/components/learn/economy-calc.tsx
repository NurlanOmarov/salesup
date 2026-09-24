"use client";

import { useEffect, useState } from "react";
import { animate, motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Calculator, Lightbulb, MessageSquareQuote, PartyPopper, RotateCcw } from "lucide-react";
import {
  isEconomyAnswerCorrect,
  parseUserNumber,
  type EconomyCalcData,
} from "@/lib/interactive";
import { usePracticeDone } from "@/components/learn/practice-context";
import { toScorePct } from "@/lib/learn/practice";

const fmt = (n: number) =>
  n.toLocaleString("ru-RU", { maximumFractionDigits: 2 }).replace(/ /g, " ");

/**
 * Тренажёр «калькулятор выгоды» (AiArtifact ECONOMY_CALC). Ученик считает
 * экономический эффект клиента по цифрам урока; верный ответ «выкатывает»
 * цифру счётчиком, раскрывает расчёт и фразу для клиента. Первая ошибка —
 * подсказка, вторая — готовый расчёт: цель — научить считать, а не завалить.
 */
export function EconomyCalc({ data }: { data: EconomyCalcData }) {
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState("");
  const [misses, setMisses] = useState(0);
  const [state, setState] = useState<"ask" | "solved" | "revealed">("ask");
  const [firstTry, setFirstTry] = useState(0);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Балл — доля расчётов, решённых с первой попытки.
  usePracticeDone("ECONOMY_CALC", finished, toScorePct(firstTry, data.rounds.length));

  const round = data.rounds[idx];
  if (!round) return null;
  const isLast = idx >= data.rounds.length - 1;

  function check() {
    if (!round || state !== "ask") return;
    const value = parseUserNumber(input);
    if (value === null) {
      setError("Введите число — например, 2 880 000 или 2,88 млн");
      return;
    }
    setError(null);
    if (isEconomyAnswerCorrect(round, value)) {
      if (misses === 0) setFirstTry((n) => n + 1);
      setState("solved");
      return;
    }
    const next = misses + 1;
    setMisses(next);
    if (next >= 2) setState("revealed");
  }

  function nextRound() {
    if (isLast) {
      setFinished(true);
      return;
    }
    setIdx((i) => i + 1);
    setInput("");
    setMisses(0);
    setError(null);
    setState("ask");
  }

  function restart() {
    setIdx(0);
    setInput("");
    setMisses(0);
    setError(null);
    setState("ask");
    setFirstTry(0);
    setFinished(false);
  }

  if (finished) {
    return (
      <div className="rounded-2xl border border-foreground/10 bg-background p-6 text-center">
        <PartyPopper className="mx-auto size-8 text-brand" />
        <p className="mt-3 text-lg font-bold">
          С первой попытки: {firstTry} из {data.rounds.length}
        </p>
        <p className="mx-auto mt-1 max-w-md text-sm text-foreground/65">
          Каждая из этих цифр — готовый аргумент для технолога, снабжения или
          финансового директора. «Наш продукт качественный» ничего не стоит, а
          посчитанные деньги клиента — стоят.
        </p>
        <button
          type="button"
          onClick={restart}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-foreground/15 px-4 py-2 text-sm font-medium transition-colors hover:border-brand/40"
        >
          <RotateCcw className="size-4" /> Посчитать заново
        </button>
      </div>
    );
  }

  const done = state !== "ask";

  return (
    <div className="rounded-2xl border border-foreground/10 bg-background p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <Calculator className="size-5" />
        </div>
        <div className="min-w-0">
          {data.title ? <h3 className="font-bold">{data.title}</h3> : null}
          {data.prompt ? <p className="mt-0.5 text-sm text-foreground/65">{data.prompt}</p> : null}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/10">
          <motion.div
            className="h-full rounded-full bg-brand"
            animate={{ width: `${((idx + (done ? 1 : 0)) / data.rounds.length) * 100}%` }}
          />
        </div>
        <span className="text-xs font-medium text-foreground/45">
          {idx + 1} / {data.rounds.length}
        </span>
      </div>

      <div className="mt-4 rounded-xl bg-foreground/[0.04] p-4">
        <p className="text-sm leading-relaxed text-foreground/80">{round.situation}</p>
        <p className="mt-2 font-semibold">{round.question}</p>
      </div>

      {!done ? (
        <form
          className="mt-3 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            check();
          }}
        >
          <div className="flex min-w-0 flex-1 items-center rounded-lg border border-foreground/15 focus-within:border-brand/50">
            <input
              inputMode="decimal"
              autoComplete="off"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ваш расчёт"
              aria-label={round.question}
              className="min-w-0 flex-1 bg-transparent px-3.5 py-2.5 text-sm outline-none"
            />
            <span className="pr-3.5 text-sm text-foreground/50">{round.unit}</span>
          </div>
          <button
            type="submit"
            className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Проверить
          </button>
          {misses > 0 ? (
            <button
              type="button"
              onClick={() => setState("revealed")}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/55 hover:text-foreground"
            >
              Показать расчёт
            </button>
          ) : null}
        </form>
      ) : null}

      <AnimatePresence mode="wait">
        {error ? (
          <motion.p
            key="err"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-2 text-sm text-foreground/60"
          >
            {error}
          </motion.p>
        ) : !done && misses === 1 ? (
          <motion.p
            key="hint"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-800"
          >
            <Lightbulb className="mt-0.5 size-4 shrink-0" />
            <span>Не сходится. {round.hint ?? "Пройдите расчёт по шагам: сначала объём, потом деньги."}</span>
          </motion.p>
        ) : null}
      </AnimatePresence>

      {done ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
          <p
            className={`text-sm font-medium ${state === "solved" ? "text-emerald-700" : "text-amber-800"}`}
          >
            {state === "solved"
              ? misses === 0
                ? "Точно! Вот так это выглядит в цифрах:"
                : "Сошлось. Вот расчёт:"
              : "Разберём расчёт:"}
          </p>
          <CountUp value={round.answer} unit={round.unit} />
          <ol className="mt-3 space-y-1.5">
            {round.steps.map((s, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-foreground/80">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground/[0.07] text-[11px] font-semibold">
                  {i + 1}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex gap-2.5 rounded-xl border border-brand/25 bg-brand/[0.06] p-3.5 text-sm">
            <MessageSquareQuote className="mt-0.5 size-4 shrink-0 text-brand" />
            <p>
              <span className="font-semibold">Скажите клиенту: </span>«{round.pitch}»
            </p>
          </div>
          <button
            type="button"
            onClick={nextRound}
            className="mt-4 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            {isLast ? "Итог" : "Следующая задача"}
          </button>
        </motion.div>
      ) : null}
    </div>
  );
}

/** Крупная цифра ответа, «докручивается» от нуля — выгода должна впечатлять. */
function CountUp({ value, unit }: { value: number; unit: string }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);

  useEffect(() => {
    if (reduce) {
      setShown(value);
      return;
    }
    const controls = animate(0, value, {
      duration: 0.9,
      ease: "easeOut",
      onUpdate: (v) => setShown(Number.isInteger(value) ? Math.round(v) : v),
    });
    return () => controls.stop();
  }, [value, reduce]);

  return (
    <p className="mt-2 text-3xl font-extrabold tabular-nums tracking-tight text-brand sm:text-4xl">
      {fmt(shown)} <span className="text-xl font-bold text-foreground/60">{unit}</span>
    </p>
  );
}
