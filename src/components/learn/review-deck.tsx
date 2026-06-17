"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCw, Check, X, PartyPopper, Repeat } from "lucide-react";

/**
 * Тренажёр интервального повторения: проходит колоду карточек к повторению.
 * Карточка переворачивается (вопрос → ответ), ученик отмечает «Помню / Не помню».
 * Результат уходит на сервер (gradeCard) и пересчитывает срок следующего повтора.
 * Колода «тает» по мере ответов; в конце — итог дня.
 */

export interface ReviewCard {
  artifactId: string;
  cardIndex: number;
  front: string;
  back: string;
  lessonTitle: string;
}

export function ReviewDeck({ initial }: { initial: ReviewCard[] }) {
  const [queue] = useState<ReviewCard[]>(initial);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [pending, setPending] = useState(false);
  const [stats, setStats] = useState({ remembered: 0, forgot: 0 });

  const total = queue.length;
  const card = queue[pos];
  const done = pos >= total;

  async function grade(remembered: boolean) {
    if (pending || !card) return;
    setPending(true);
    try {
      await fetch("/api/learn/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artifactId: card.artifactId, cardIndex: card.cardIndex, remembered }),
      });
    } catch {
      // тихо: даже при сбое сети двигаем колоду — результат не критичен для UX
    } finally {
      setStats((s) => ({
        remembered: s.remembered + (remembered ? 1 : 0),
        forgot: s.forgot + (remembered ? 0 : 1),
      }));
      setFlipped(false);
      setPos((p) => p + 1);
      setPending(false);
    }
  }

  if (total === 0) {
    return (
      <div className="rounded-2xl border border-foreground/10 bg-background p-8 text-center">
        <Repeat className="mx-auto size-10 text-foreground/30" />
        <p className="mt-3 text-lg font-semibold">На сегодня всё повторено</p>
        <p className="mt-1 text-sm text-foreground/55">
          Возвращайтесь завтра — карточки появятся по мере того, как подходит срок повторения.
        </p>
      </div>
    );
  }

  if (done || !card) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-8 text-center">
        <PartyPopper className="mx-auto size-10 text-emerald-500" />
        <p className="mt-3 text-lg font-semibold">Повторение завершено</p>
        <p className="mt-1 text-sm text-foreground/70">
          Помню: <b className="text-emerald-600">{stats.remembered}</b> · Повторить:{" "}
          <b className="text-amber-600">{stats.forgot}</b> из {total}
        </p>
        <p className="mt-2 text-xs text-foreground/50">
          Карточки, что не дались, вернутся завтра; остальные — по графику интервалов.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-foreground/10 bg-background p-4 sm:p-5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-foreground/55">
          Карточка {pos + 1} из {total}
        </span>
        <span className="text-foreground/45">{card.lessonTitle}</span>
      </div>

      {/* Прогресс-полоска */}
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/10">
        <motion.div
          className="h-full rounded-full bg-amber-500"
          initial={false}
          animate={{ width: `${(pos / total) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Карточка с переворотом */}
      <button
        onClick={() => setFlipped((f) => !f)}
        className="mt-4 flex min-h-[200px] w-full items-center justify-center rounded-xl border border-foreground/15 bg-foreground/[0.02] p-6 text-center"
        aria-label="Перевернуть карточку"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={flipped ? `b-${pos}` : `f-${pos}`}
            initial={{ rotateX: 90, opacity: 0 }}
            animate={{ rotateX: 0, opacity: 1 }}
            exit={{ rotateX: -90, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="w-full"
          >
            {flipped ? (
              <p className="text-base text-foreground/90">{card.back}</p>
            ) : (
              <p className="text-lg font-semibold text-foreground">{card.front}</p>
            )}
          </motion.div>
        </AnimatePresence>
      </button>

      {!flipped ? (
        <button
          onClick={() => setFlipped(true)}
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-foreground/15 py-2.5 text-sm font-medium transition-colors hover:bg-foreground/5"
        >
          <RotateCw className="size-4" />
          Показать ответ
        </button>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => grade(false)}
            disabled={pending}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/[0.06] py-2.5 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-500/10 disabled:opacity-40"
          >
            <X className="size-4" />
            Не помню
          </button>
          <button
            onClick={() => grade(true)}
            disabled={pending}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] py-2.5 text-sm font-semibold text-emerald-600 transition-colors hover:bg-emerald-500/10 disabled:opacity-40"
          >
            <Check className="size-4" />
            Помню
          </button>
        </div>
      )}
    </div>
  );
}
