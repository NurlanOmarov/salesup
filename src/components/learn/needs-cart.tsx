"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PartyPopper, RotateCcw } from "lucide-react";
import { CART_KIND_ORDER, type CartQuestion, type NeedsCartData } from "@/lib/interactive";
import { seededShuffle } from "@/lib/learn/format";
import { usePracticeDone } from "@/components/learn/practice-context";

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
  // Пул перемешан стабильно: в данных вопросы часто уже стоят по порядку воронки.
  const shuffled = useMemo(
    () => seededShuffle(data.questions, data.questions.map((q) => q.text).join("|")),
    [data.questions],
  );
  const [pool, setPool] = useState<CartQuestion[]>(shuffled);
  const [reject, setReject] = useState<{ i: number; text: string } | null>(null);

  // Пока в пуле остались вопросы более раннего типа воронки — принимаем только их.
  const minKindInPool = pool.reduce((m, q) => Math.min(m, CART_KIND_ORDER[q.kind]), Infinity);
  const done = pool.length === 0;
  // Каждый вопрос не по порядку воронки снимает 15 баллов.
  const [misses, setMisses] = useState(0);
  usePracticeDone("NEEDS_CART", done, Math.max(0, 100 - misses * 15));

  function pick(q: CartQuestion, i: number) {
    if (CART_KIND_ORDER[q.kind] > minKindInPool) {
      setMisses((m) => m + 1);
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
    setPool(shuffled);
    setReject(null);
    setMisses(0);
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
  // Товары падают ВНУТРЬ корзины: сначала нижний ряд, потом верхний. Раньше они
  // висели над тележкой, а ручка заходила в корзину.
  const items = 6;
  const filled = Math.round(progress * items);
  const slots = [
    { x: 42, y: 90 },
    { x: 70, y: 90 },
    { x: 98, y: 90 },
    { x: 54, y: 70 },
    { x: 82, y: 70 },
    { x: 108, y: 70 },
  ];
  // Корзина — трапеция: верх y=64 (x 24..140), низ y=112 (x 38..126).
  const edgeX = (y: number, side: "l" | "r") => {
    const k = (y - 64) / 48;
    return side === "l" ? 24 + 14 * k : 140 - 14 * k;
  };
  return (
    <svg viewBox="0 0 160 140" className="h-32 w-36 shrink-0 justify-self-center sm:h-36 sm:w-40" role="img" aria-label="Тележка потребностей">
      {/* задняя стенка корзины */}
      <path d="M24 64 H140 L126 112 H38 Z" className="fill-foreground/[0.05]" />

      {slots.slice(0, items).map((p, i) => {
        const on = i < filled;
        return (
          <motion.rect
            key={i}
            x={p.x}
            width="22"
            height="18"
            rx="3"
            initial={false}
            animate={{ y: on ? p.y : p.y - 40, opacity: on ? 1 : 0 }}
            transition={{ type: "spring", stiffness: 240, damping: 18 }}
            className={i < 3 ? "fill-brand/75" : "fill-brand/55"}
          />
        );
      })}

      {/* сетка и контур корзины — поверх товаров, как передняя стенка */}
      {[88].map((y) => (
        <line key={y} x1={edgeX(y, "l")} y1={y} x2={edgeX(y, "r")} y2={y} className="stroke-foreground/15" strokeWidth="1.5" />
      ))}
      {[52, 72, 92, 112].map((x) => (
        <line key={x} x1={x} y1={64} x2={38 + ((x - 24) / 116) * 88} y2={112} className="stroke-foreground/15" strokeWidth="1.5" />
      ))}
      <path d="M24 64 H140 L126 112 H38 Z" fill="none" className="stroke-foreground/35" strokeWidth="2.5" strokeLinejoin="round" />

      {/* ручка — снаружи, от левого верхнего угла */}
      <path d="M24 64 L14 44 H4" fill="none" className="stroke-foreground/35" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

      {/* рама и колёса */}
      <path d="M38 112 L42 120 H122 L126 112" fill="none" className="stroke-foreground/35" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="50" cy="128" r="7" className="fill-foreground/30" />
      <circle cx="114" cy="128" r="7" className="fill-foreground/30" />
    </svg>
  );
}
