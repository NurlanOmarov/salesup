"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PartyPopper, RotateCcw } from "lucide-react";
import { CART_KIND_ORDER, type CartQuestion, type NeedsCartData } from "@/lib/interactive";

const KIND_LABEL: Record<string, string> = {
  open: "открытый",
  alt: "альтернативный",
  closed: "закрытый",
};

/** Порядок kind по возрастанию приоритета воронки — обратный к CART_KIND_ORDER, для сообщений. */
const KIND_BY_PRIORITY: (keyof typeof CART_KIND_ORDER)[] = ["open", "alt", "closed"];

/**
 * Игра «тележка потребностей» (S: bespoke). Пул реальных вопросов урока, у
 * каждого тип — открытый/альтернативный/закрытый. Клик принимается, только
 * если тип вопроса не «раньше» уже собранных по воронке (open→alt→closed) —
 * иначе карточка «отскакивает» назад в пул с объяснением. Тележка заполняется
 * пропорционально прогрессу — учит порядок вопросов, а не просто факт о нём.
 */
export function NeedsCart({ data }: { data: NeedsCartData }) {
  const [picked, setPicked] = useState<CartQuestion[]>([]);
  const [pool, setPool] = useState<CartQuestion[]>(data.questions);
  const [reject, setReject] = useState<{ i: number; text: string } | null>(null);

  // Пока в пуле остались вопросы более раннего типа воронки — принимаем только их.
  const minKindInPool = pool.reduce((m, q) => Math.min(m, CART_KIND_ORDER[q.kind]), Infinity);
  const done = pool.length === 0;

  function pick(q: CartQuestion, i: number) {
    if (CART_KIND_ORDER[q.kind] > minKindInPool) {
      const earlierLabel = KIND_LABEL[KIND_BY_PRIORITY[minKindInPool] ?? "open"];
      setReject({
        i,
        text: `Рано: это ${KIND_LABEL[q.kind]} вопрос, а в пуле ещё остались ${earlierLabel} — сначала доведите их до конца.`,
      });
      setTimeout(() => setReject(null), 1600);
      return;
    }
    setReject(null);
    setPicked((p) => [...p, q]);
    setPool((p) => p.filter((_, idx) => idx !== i));
  }

  function reset() {
    setPicked([]);
    setPool(data.questions);
    setReject(null);
  }

  return (
    <div className="rounded-2xl border border-foreground/10 bg-background p-5 sm:p-6">
      {data.title ? <h3 className="font-bold">{data.title}</h3> : null}
      {data.prompt ? <p className="mt-1 text-sm text-foreground/65">{data.prompt}</p> : null}

      <div className="mt-5 grid gap-6 sm:grid-cols-[auto_1fr] sm:items-start">
        <CartVisual progress={picked.length / data.questions.length} />

        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground/55">
            Соберите вопросы в правильном порядке: сначала открытые, потом альтернативные, потом закрытые
          </p>

          <div className="mt-2 flex flex-wrap gap-2">
            <AnimatePresence initial={false}>
              {pool.map((q, i) => (
                <motion.button
                  key={`${q.kind}-${q.text}`}
                  type="button"
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    x: reject?.i === i ? [0, -6, 6, -4, 0] : 0,
                  }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  onClick={() => pick(q, i)}
                  className="rounded-full border border-foreground/15 bg-foreground/[0.03] px-3.5 py-1.5 text-sm font-medium transition-colors hover:border-brand/40"
                >
                  {q.text}
                </motion.button>
              ))}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {reject ? (
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-800"
              >
                {reject.text}
              </motion.p>
            ) : null}
          </AnimatePresence>

          {picked.length > 0 ? (
            <ul className="mt-4 space-y-1.5">
              <AnimatePresence initial={false}>
                {picked.map((q, i) => (
                  <motion.li
                    key={`${q.kind}-${q.text}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2 rounded-lg bg-emerald-500/[0.06] px-3 py-1.5 text-sm"
                  >
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-[11px] font-semibold text-emerald-700">
                      {i + 1}
                    </span>
                    <span className="flex-1 text-foreground/80">{q.text}</span>
                    <span className="text-[11px] font-medium text-foreground/40">{KIND_LABEL[q.kind]}</span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          ) : null}

          {done ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700"
            >
              <PartyPopper className="size-4 shrink-0" />
              Тележка полна — потребность выяснена по всем правилам воронки!
            </motion.div>
          ) : null}

          {done ? (
            <button
              type="button"
              onClick={reset}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-foreground/50 transition-colors hover:text-foreground/80"
            >
              <RotateCcw className="size-3.5" />
              Собрать снова
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CartVisual({ progress }: { progress: number }) {
  const items = 6;
  const filled = Math.round(progress * items);
  return (
    <svg viewBox="0 0 160 140" className="h-32 w-36 shrink-0 justify-self-center sm:h-36 sm:w-40" role="img" aria-label="Тележка потребностей">
      {/* товары над тележкой — заполняются по прогрессу */}
      {Array.from({ length: items }).map((_, i) => {
        const on = i < filled;
        const x = 24 + (i % 3) * 34;
        const y = 18 + Math.floor(i / 3) * 26;
        return (
          <motion.rect
            key={i}
            x={x}
            y={y}
            width="24"
            height="20"
            rx="4"
            initial={false}
            animate={{ opacity: on ? 1 : 0, scale: on ? 1 : 0.6 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="fill-brand/70"
          />
        );
      })}

      {/* корзина тележки */}
      <path d="M20 78 h108 l-14 42 h-80 z" className="fill-foreground/[0.06] stroke-foreground/25" strokeWidth="2.5" />
      <path d="M8 70 h20 l8 12" className="stroke-foreground/25" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="52" cy="130" r="8" className="fill-foreground/25" />
      <circle cx="104" cy="130" r="8" className="fill-foreground/25" />
    </svg>
  );
}
