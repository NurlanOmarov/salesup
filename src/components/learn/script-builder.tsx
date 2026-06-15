"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, X, RefreshCw, Trophy, ArrowRight } from "lucide-react";
import type { ScriptBuilderData } from "@/lib/interactive";

/**
 * Конструктор скрипта: ученик собирает этапы звонка/визита в правильном порядке,
 * выбирая шаги по одному из перемешанного набора. Эталон — исходный порядок шагов.
 * Без записи на сервер: практика структуры разговора.
 */

// Детерминированная перетасовка — без Math.random, стабильно при ререндере.
function shuffle(indices: number[]): number[] {
  return [...indices].sort((x, y) => ((x * 7 + 3) % 11) - ((y * 7 + 3) % 11));
}

export function ScriptBuilder({ data }: { data: ScriptBuilderData }) {
  const steps = data.steps;
  const order = useMemo(() => shuffle(steps.map((_, i) => i)), [steps]);
  const [picked, setPicked] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);

  const remaining = order.filter((i) => !picked.includes(i));
  const pick = (i: number) => {
    if (checked) return;
    setPicked((p) => [...p, i]);
  };
  const undo = () => setPicked((p) => p.slice(0, -1));
  const reset = () => {
    setPicked([]);
    setChecked(false);
  };

  const correctCount = picked.filter((stepIdx, pos) => stepIdx === pos).length;
  const allCorrect = checked && correctCount === steps.length;

  return (
    <div className="rounded-2xl border border-foreground/10 bg-background p-4 sm:p-5">
      <p className="font-semibold">Соберите скрипт по порядку</p>
      <p className="mt-0.5 text-sm text-foreground/55">
        Нажимайте шаги в той последовательности, в которой ведёте разговор.
      </p>

      {/* Собранная последовательность */}
      <ol className="mt-4 space-y-2">
        {picked.map((stepIdx, pos) => {
          const step = steps[stepIdx]!;
          const isRight = checked && stepIdx === pos;
          const isWrong = checked && stepIdx !== pos;
          return (
            <motion.li
              key={`${stepIdx}-${pos}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={[
                "flex items-start gap-3 rounded-xl border p-3",
                isRight ? "border-emerald-500/40 bg-emerald-500/[0.07]" : "",
                isWrong ? "border-rose-500/40 bg-rose-500/[0.07]" : "",
                !checked ? "border-foreground/15" : "",
              ].join(" ")}
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-xs font-semibold">
                {pos + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-xs font-medium text-amber-700">{step.stage}</span>
                <span className="block text-sm text-foreground/85">{step.text}</span>
              </span>
              {checked ? (
                isRight ? (
                  <Check className="size-4 shrink-0 text-emerald-600" />
                ) : (
                  <X className="size-4 shrink-0 text-rose-600" />
                )
              ) : null}
            </motion.li>
          );
        })}
      </ol>

      {/* Банк оставшихся шагов */}
      {!checked && remaining.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {remaining.map((i) => (
            <button
              key={i}
              onClick={() => pick(i)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/15 px-3 py-2 text-sm transition-colors hover:border-amber-500/40 hover:bg-amber-500/[0.06]"
            >
              {steps[i]!.stage}
              <ArrowRight className="size-3.5 text-foreground/40" />
            </button>
          ))}
        </div>
      ) : null}

      {/* Управление */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {!checked ? (
          <>
            <button
              onClick={() => setChecked(true)}
              disabled={picked.length !== steps.length}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400 disabled:opacity-40"
            >
              Проверить
            </button>
            {picked.length > 0 ? (
              <button
                onClick={undo}
                className="rounded-lg border border-foreground/15 px-3 py-2 text-sm transition-colors hover:bg-foreground/5"
              >
                Отменить шаг
              </button>
            ) : null}
          </>
        ) : (
          <div className="flex w-full items-center justify-between gap-3">
            <span className={`flex items-center gap-2 text-sm font-medium ${allCorrect ? "text-emerald-700" : "text-foreground/70"}`}>
              {allCorrect ? <Trophy className="size-4 text-amber-500" /> : null}
              Верно {correctCount} из {steps.length}
            </span>
            <button
              onClick={reset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/15 px-3 py-2 text-sm transition-colors hover:bg-foreground/5"
            >
              <RefreshCw className="size-4" />
              Заново
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
