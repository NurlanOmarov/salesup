"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Clock, Sparkles } from "lucide-react";
import type { LandingContent } from "@/content/landing";

interface Msg {
  role: "user" | "ai";
  text: string;
  source?: string;
}

/**
 * Интерактивная демонстрация AI-наставника на лендинге (ТЗ §4.1.1).
 * Полностью заскриптована (без API): первый обмен проигрывается сам,
 * дальше посетитель кликает готовые вопросы-чипы.
 */
/** Контент приходит с сервера: демо переводится вместе с лендингом (казахская версия). */
export function AiDemo({ aiDemo }: { aiDemo: LandingContent["aiDemo"] }) {
  const reduce = useReducedMotion();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [usedChips, setUsedChips] = useState<Set<number>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  // автопроигрывание первого обмена
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (reduce) {
      setMessages([
        { role: "user", text: aiDemo.intro.question },
        { role: "ai", text: aiDemo.intro.answer, source: aiDemo.intro.source },
      ]);
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(
      setTimeout(() => {
        setMessages([{ role: "user", text: aiDemo.intro.question }]);
        setTyping(true);
      }, 700),
      setTimeout(() => {
        setTyping(false);
        setMessages((m) => [
          ...m,
          { role: "ai", text: aiDemo.intro.answer, source: aiDemo.intro.source },
        ]);
      }, 2100),
    );
    return () => timers.forEach(clearTimeout);
    // aiDemo приходит пропсом (перевод лендинга) — включаем в зависимости,
    // хотя startedRef и так не даёт проиграть сценарий дважды.
  }, [reduce, aiDemo]);

  // автоскролл к последнему сообщению внутри виджета
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: reduce ? "auto" : "smooth",
    });
  }, [messages, typing, reduce]);

  function askChip(i: number) {
    if (typing || usedChips.has(i)) return;
    const chip = aiDemo.chips[i];
    if (!chip) return;
    setUsedChips((s) => new Set(s).add(i));
    setMessages((m) => [...m, { role: "user", text: chip.question }]);
    if (reduce) {
      setMessages((m) => [
        ...m,
        { role: "ai", text: chip.answer, source: chip.source },
      ]);
      return;
    }
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMessages((m) => [
        ...m,
        { role: "ai", text: chip.answer, source: chip.source },
      ]);
    }, 1200);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80 shadow-2xl shadow-black/40 backdrop-blur">
      {/* шапка виджета */}
      <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-3">
        <span className="flex size-8 items-center justify-center rounded-full bg-amber-500/15">
          <Sparkles className="size-4 text-amber-400" />
        </span>
        <div>
          <p className="text-sm font-semibold text-white">{aiDemo.title}</p>
          <p className="flex items-center gap-1.5 text-xs text-white/50">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            {aiDemo.status}
          </p>
        </div>
      </div>

      {/* сообщения */}
      <div
        ref={scrollRef}
        className="flex h-72 flex-col gap-3 overflow-y-auto px-4 py-4 sm:h-80"
        aria-live="polite"
      >
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={
                m.role === "user"
                  ? "ml-8 self-end rounded-2xl rounded-br-sm bg-amber-500 px-3.5 py-2.5 text-sm font-medium text-slate-950"
                  : "mr-4 self-start rounded-2xl rounded-bl-sm bg-white/10 px-3.5 py-2.5 text-sm text-white/90"
              }
            >
              {m.text}
              {m.source ? (
                <span className="mt-2 flex w-fit items-center gap-1 rounded-full bg-slate-950/40 px-2 py-0.5 text-xs text-amber-300">
                  <Clock className="size-3" />
                  {m.source}
                </span>
              ) : null}
            </motion.div>
          ))}
        </AnimatePresence>
        {typing ? (
          <div className="mr-4 flex items-center gap-1 self-start rounded-2xl rounded-bl-sm bg-white/10 px-4 py-3">
            <span className="size-1.5 animate-bounce rounded-full bg-white/60 [animation-delay:0ms]" />
            <span className="size-1.5 animate-bounce rounded-full bg-white/60 [animation-delay:120ms]" />
            <span className="size-1.5 animate-bounce rounded-full bg-white/60 [animation-delay:240ms]" />
          </div>
        ) : null}
      </div>

      {/* чипы вопросов */}
      <div className="border-t border-white/10 px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {aiDemo.chips.map((c, i) => (
            <button
              key={c.question}
              type="button"
              onClick={() => askChip(i)}
              disabled={typing || usedChips.has(i)}
              className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-white/80 transition-colors hover:border-amber-400/60 hover:text-amber-300 disabled:opacity-40"
            >
              {c.question}
            </button>
          ))}
        </div>
        <p className="mt-2.5 text-[11px] leading-snug text-white/60">
          {aiDemo.disclaimer}
        </p>
      </div>
    </div>
  );
}
