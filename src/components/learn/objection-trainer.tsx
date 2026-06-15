"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquareWarning, Check, X, Lightbulb, ChevronRight, RefreshCw, Trophy } from "lucide-react";
import type { ObjectionsData } from "@/lib/interactive";

/**
 * Тренажёр отработки возражений (S-интерактив для курсов о продажах). Клиент
 * озвучивает возражение — ученик выбирает лучший ответ менеджера и сразу видит
 * разбор каждого варианта. В конце — счёт. Без записи на сервер: лёгкая практика.
 */
export function ObjectionTrainer({ data }: { data: ObjectionsData }) {
  const items = data.items;
  const total = items.length;
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);

  const item = items[index];
  const answered = picked !== null;

  const pick = (i: number) => {
    if (answered || !item) return;
    setPicked(i);
    if (item.options[i]?.correct) setCorrectCount((c) => c + 1);
  };

  const next = () => {
    if (index < total - 1) {
      setIndex(index + 1);
      setPicked(null);
    } else {
      setDone(true);
    }
  };

  const restart = () => {
    setIndex(0);
    setPicked(null);
    setCorrectCount(0);
    setDone(false);
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-foreground/10 bg-background p-8 text-center">
        <Trophy className="mx-auto size-10 text-amber-500" />
        <p className="mt-3 text-lg font-bold">
          {correctCount} из {total}
        </p>
        <p className="mt-1 text-sm text-foreground/60">
          {correctCount === total
            ? "Отлично! Все возражения отработаны верно."
            : "Хороший результат. Повторите разбор и попробуйте снова."}
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

  if (!item) return null;

  return (
    <div className="rounded-2xl border border-foreground/10 bg-background p-4 sm:p-5">
      <div className="flex items-center justify-between text-sm text-foreground/55">
        <span>
          Возражение {index + 1} из {total}
        </span>
        <span>Верных: {correctCount}</span>
      </div>

      {/* Реплика клиента */}
      <div className="mt-3 flex gap-3 rounded-2xl border border-rose-500/25 bg-rose-500/[0.06] p-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-rose-600">
          <MessageSquareWarning className="size-5" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-rose-600">Клиент возражает</p>
          <p className="mt-0.5 font-semibold">«{item.objection}»</p>
        </div>
      </div>

      <p className="mt-4 text-sm font-medium text-foreground/70">Выберите лучший ответ:</p>

      {/* Варианты ответа */}
      <div className="mt-2 space-y-2">
        {item.options.map((o, i) => {
          const isPicked = picked === i;
          const reveal = answered && (o.correct || isPicked);
          return (
            <button
              key={i}
              onClick={() => pick(i)}
              disabled={answered}
              className={[
                "w-full rounded-xl border p-3 text-left text-sm transition-colors",
                !answered ? "border-foreground/15 hover:border-amber-500/40 hover:bg-amber-500/[0.05]" : "",
                reveal && o.correct ? "border-emerald-500/40 bg-emerald-500/[0.08]" : "",
                reveal && !o.correct ? "border-rose-500/40 bg-rose-500/[0.07]" : "",
                answered && !reveal ? "border-foreground/10 opacity-55" : "",
              ].join(" ")}
            >
              <div className="flex items-start gap-2.5">
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
              </div>
              <AnimatePresence>
                {reveal ? (
                  <motion.p
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    className="mt-2 overflow-hidden pl-6 text-xs text-foreground/60"
                  >
                    {o.feedback}
                  </motion.p>
                ) : null}
              </AnimatePresence>
            </button>
          );
        })}
      </div>

      {/* Подсказка-вывод + далее */}
      {answered ? (
        <div className="mt-4">
          {item.tip ? (
            <div className="flex gap-2 rounded-xl bg-amber-500/[0.07] p-3 text-sm text-foreground/75">
              <Lightbulb className="size-4 shrink-0 text-amber-600" />
              <span>{item.tip}</span>
            </div>
          ) : null}
          <button
            onClick={next}
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
          >
            {index < total - 1 ? "Следующее возражение" : "Завершить"}
            <ChevronRight className="size-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
