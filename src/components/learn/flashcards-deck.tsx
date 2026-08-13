"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, RotateCw, RefreshCw, Check } from "lucide-react";
import type { FlashcardsData } from "@/lib/interactive";

/**
 * Тренажёр флеш-карточек урока: лицо (термин/вопрос) → переворот → оборот (ответ).
 * Карточки листаются, можно отметить «знаю»; в конце — счётчик и перезапуск.
 * Без сохранения на сервер — лёгкий тренажёр запоминания (повторение материала).
 */
export function FlashcardsDeck({ deck }: { deck: FlashcardsData }) {
  const cards = deck.cards;
  const total = cards.length;
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const reduceMotion = useReducedMotion();
  const [known, setKnown] = useState<Set<number>>(new Set());

  const go = (next: number) => {
    setFlipped(false);
    setIndex(Math.max(0, Math.min(total - 1, next)));
  };

  const markKnown = () => {
    setKnown((s) => new Set(s).add(index));
    if (index < total - 1) go(index + 1);
  };

  const reset = () => {
    setKnown(new Set());
    setFlipped(false);
    setIndex(0);
  };

  const card = cards[index];
  if (!card) return null;

  return (
    <div className="rounded-2xl border border-foreground/10 bg-background p-4 sm:p-5">
      <div className="flex items-center justify-between text-sm text-foreground/55">
        <span>
          Карточка {index + 1} из {total}
        </span>
        <span className="inline-flex items-center gap-1.5 text-emerald-600">
          <Check className="size-4" />
          Знаю: {known.size}
        </span>
      </div>

      {/* Карточка с переворотом */}
      <button
        onClick={() => setFlipped((f) => !f)}
        className="group relative mt-3 flex min-h-[200px] w-full items-center justify-center overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/[0.07] to-transparent p-6 text-center transition-colors hover:from-amber-500/[0.12] sm:min-h-[240px]"
        style={{ perspective: 1000 }}
      >
        {/* Настоящий переворот: обе грани живут на одной карточке и вращаются
            вместе с ней, а не подменяют друг друга. Грид кладёт их в одну
            ячейку — высота карточки считается по самой длинной стороне. */}
        <motion.div
          className="grid w-full"
          style={{ transformStyle: "preserve-3d" }}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={
            reduceMotion ? { duration: 0 } : { duration: 0.5, ease: [0.22, 1, 0.36, 1] }
          }
        >
          <div className="col-start-1 row-start-1 flex flex-col items-center gap-2 [backface-visibility:hidden]">
            <span className="text-xs font-medium uppercase tracking-wide text-amber-700">
              Вопрос
            </span>
            <p className="text-lg font-semibold">{card.front}</p>
          </div>
          <div className="col-start-1 row-start-1 flex flex-col items-center gap-2 [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <span className="text-xs font-medium uppercase tracking-wide text-amber-700">
              Ответ
            </span>
            <p className="text-base text-foreground/80">{card.back}</p>
          </div>
        </motion.div>
        <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 text-xs text-foreground/40 transition-colors group-hover:text-foreground/60">
          <RotateCw className="size-3.5" />
          перевернуть
        </span>
      </button>

      {/* Навигация */}
      <div className="mt-4 flex items-center justify-between gap-2">
        <button
          onClick={() => go(index - 1)}
          disabled={index === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/15 px-3 py-2 text-sm transition-colors hover:bg-foreground/5 disabled:opacity-40"
        >
          <ChevronLeft className="size-4" />
          Назад
        </button>

        <button
          onClick={markKnown}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-500/20"
        >
          <Check className="size-4" />
          Знаю
        </button>

        {index < total - 1 ? (
          <button
            onClick={() => go(index + 1)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/15 px-3 py-2 text-sm transition-colors hover:bg-foreground/5"
          >
            Дальше
            <ChevronRight className="size-4" />
          </button>
        ) : (
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/15 px-3 py-2 text-sm transition-colors hover:bg-foreground/5"
          >
            <RefreshCw className="size-4" />
            Заново
          </button>
        )}
      </div>
    </div>
  );
}
