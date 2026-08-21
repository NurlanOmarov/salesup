"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Clock, Sparkles } from "lucide-react";
import type { LandingContent } from "@/content/landing";

interface Msg {
  id: number;
  role: "user" | "ai";
  text: string;
  source?: string;
}

/**
 * Интерактивная демонстрация AI-наставника на лендинге (ТЗ §4.1.1).
 * Полностью заскриптована (без API): диалог проигрывается сам по кругу
 * (вопрос → «печатает» → ответ, затем следующий вопрос), а как только
 * посетитель кликает чип — автопрокрутка сценария выключается и дальше
 * он ведёт диалог сам.
 */
/** Контент приходит с сервера: демо переводится вместе с лендингом (казахская версия). */
export function AiDemo({ aiDemo }: { aiDemo: LandingContent["aiDemo"] }) {
  const reduce = useReducedMotion();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [usedChips, setUsedChips] = useState<Set<number>>(new Set());
  /** индекс чипа, «нажатого» автосценарием — подсветка вместо курсора */
  const [autoChip, setAutoChip] = useState<number | null>(null);
  /** посетитель вмешался — сценарий больше не крутится */
  const [taken, setTaken] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);
  /** виджет в зоне видимости: за экраном сценарий стоит на паузе */
  const visibleRef = useRef(true);

  /** Сценарий: вступительный обмен + все чипы по порядку. */
  const script = useMemo(
    () => [
      {
        question: aiDemo.intro.question,
        answer: aiDemo.intro.answer,
        source: aiDemo.intro.source,
      },
      ...aiDemo.chips.map((c) => ({
        question: c.question,
        answer: c.answer,
        source: c.source,
      })),
    ],
    [aiDemo],
  );

  function nextId() {
    idRef.current += 1;
    return idRef.current;
  }

  // пауза сценария, когда блок ушёл за экран
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry?.isIntersecting ?? true;
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // автопроигрывание диалога по кругу
  useEffect(() => {
    if (reduce) {
      setMessages([
        { id: nextId(), role: "user", text: aiDemo.intro.question },
        {
          id: nextId(),
          role: "ai",
          text: aiDemo.intro.answer,
          source: aiDemo.intro.source,
        },
      ]);
      return;
    }
    if (taken) return;

    let cancelled = false;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        const t = setTimeout(() => {
          timers.delete(t);
          resolve();
        }, ms);
        timers.add(t);
      });
    /** ждём паузу и, если блок за экраном, стоим до его появления */
    const wait = async (ms: number) => {
      await sleep(ms);
      while (!cancelled && !visibleRef.current) await sleep(400);
    };

    (async () => {
      // рестарт: начинаем с чистого чата
      setMessages([]);
      setUsedChips(new Set());
      setTyping(false);
      setAutoChip(null);

      while (!cancelled) {
        for (let i = 0; i < script.length; i++) {
          const step = script[i]!;
          await wait(i === 0 ? 700 : 2600);
          if (cancelled) return;

          // «нажатие» чипа: у вступления чипа нет.
          // Чипы при этом НЕ гасим — посетитель должен иметь возможность
          // перехватить диалог в любой момент показа.
          if (i > 0) {
            setAutoChip(i - 1);
            await wait(420);
            if (cancelled) return;
            setAutoChip(null);
          }

          setMessages((m) => [
            ...m,
            { id: nextId(), role: "user", text: step.question },
          ]);
          setTyping(true);
          await wait(1400);
          if (cancelled) return;
          setTyping(false);
          setMessages((m) => [
            ...m,
            {
              id: nextId(),
              role: "ai",
              text: step.answer,
              source: step.source,
            },
          ]);
        }

        // пауза на прочтение — и заново
        await wait(5200);
        if (cancelled) return;
        setMessages([]);
        await wait(900);
      }
    })();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, [reduce, taken, script, aiDemo]);

  // автоскролл к последнему сообщению внутри виджета
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: reduce ? "auto" : "smooth",
    });
  }, [messages, typing, reduce]);

  function askChip(i: number) {
    if ((taken && typing) || usedChips.has(i)) return;
    const chip = aiDemo.chips[i];
    if (!chip) return;
    // клик посетителя останавливает автосценарий: дальше диалог ведёт он
    setTaken(true);
    setAutoChip(null);
    setUsedChips((s) => new Set(s).add(i));
    setMessages((m) => [
      ...m,
      { id: nextId(), role: "user", text: chip.question },
    ]);
    if (reduce) {
      setMessages((m) => [
        ...m,
        { id: nextId(), role: "ai", text: chip.answer, source: chip.source },
      ]);
      return;
    }
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMessages((m) => [
        ...m,
        { id: nextId(), role: "ai", text: chip.answer, source: chip.source },
      ]);
    }, 1200);
  }

  return (
    <div
      ref={boxRef}
      className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80 shadow-2xl shadow-black/40 backdrop-blur"
    >
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
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -6 }}
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
              disabled={(taken && typing) || usedChips.has(i)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200 disabled:opacity-40 ${
                autoChip === i
                  ? "scale-95 border-amber-400 bg-amber-400/15 text-amber-200"
                  : "border-white/15 text-white/80 hover:border-amber-400/60 hover:text-amber-300"
              }`}
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
