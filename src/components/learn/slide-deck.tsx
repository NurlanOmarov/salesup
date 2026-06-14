"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Check,
  X,
  Quote,
} from "lucide-react";
import type { DeckSlide, DeckTheme, SlideDeckData } from "@/lib/slides";

/**
 * Просмотрщик презентации урока (HTML, адаптивный — десктоп и мобильный).
 *
 * Слайды листаются стрелками, клавишами ←/→, свайпом по экрану и точечной
 * навигацией; есть полноэкранный режим. Слайд держит формат 16:9 на широких
 * экранах и тянется по высоте контента на узких, чтобы текст не обрезался.
 */

const THEMES: Record<DeckTheme, { grad: string; accent: string; ring: string; dot: string }> = {
  amber: {
    grad: "from-amber-500 via-orange-500 to-amber-600",
    accent: "text-amber-600",
    ring: "bg-amber-500",
    dot: "bg-amber-500",
  },
  violet: {
    grad: "from-violet-500 via-purple-500 to-fuchsia-600",
    accent: "text-violet-600",
    ring: "bg-violet-500",
    dot: "bg-violet-500",
  },
  sky: {
    grad: "from-sky-500 via-cyan-500 to-blue-600",
    accent: "text-sky-600",
    ring: "bg-sky-500",
    dot: "bg-sky-500",
  },
  emerald: {
    grad: "from-emerald-500 via-teal-500 to-green-600",
    accent: "text-emerald-600",
    ring: "bg-emerald-500",
    dot: "bg-emerald-500",
  },
  rose: {
    grad: "from-rose-500 via-pink-500 to-rose-600",
    accent: "text-rose-600",
    ring: "bg-rose-500",
    dot: "bg-rose-500",
  },
};

export function SlideDeck({ deck }: { deck: SlideDeckData }) {
  const theme = THEMES[deck.theme ?? "amber"];
  const slides = deck.slides;
  const total = slides.length;
  const safeIndex = (i: number) => Math.max(0, Math.min(total - 1, i));
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [fs, setFs] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const go = useCallback(
    (next: number) => {
      setIndex((cur) => {
        const clamped = Math.max(0, Math.min(total - 1, next));
        setDir(clamped >= cur ? 1 : -1);
        return clamped;
      });
    },
    [total],
  );
  const prev = useCallback(() => go(index - 1), [go, index]);
  const next = useCallback(() => go(index + 1), [go, index]);
  const current = slides[safeIndex(index)] ?? slides[0]!;

  // Клавиатура: стрелки ←/→ листают слайды, пока вкладка презентации открыта
  // (колода смонтирована). Слушаем на window, чтобы не требовать клика по блоку;
  // игнорируем нажатия в полях ввода и при зажатых модификаторах.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        prev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  // Полноэкранный режим браузера.
  const toggleFs = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);
  useEffect(() => {
    const onChange = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const onDragEnd = (_e: unknown, info: PanInfo) => {
    if (info.offset.x < -60 || info.velocity.x < -300) next();
    else if (info.offset.x > 60 || info.velocity.x > 300) prev();
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className={`group relative overflow-hidden rounded-2xl border border-foreground/10 bg-background outline-none ${
        fs ? "flex h-screen flex-col justify-center bg-foreground/[0.02]" : ""
      }`}
    >
      {/* Прогресс-полоса */}
      <div className="absolute inset-x-0 top-0 z-20 h-1 bg-foreground/10">
        <motion.div
          className={`h-full ${theme.ring}`}
          animate={{ width: `${((index + 1) / total) * 100}%` }}
          transition={{ type: "spring", stiffness: 220, damping: 30 }}
        />
      </div>

      {/* Сцена слайда: 16:9 на десктопе, по контенту (min-height) на мобильном */}
      <div className="relative min-h-[440px] sm:aspect-[16/9] sm:min-h-0">
        <AnimatePresence custom={dir} mode="popLayout" initial={false}>
          <motion.div
            key={index}
            custom={dir}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            onDragEnd={onDragEnd}
            initial={{ opacity: 0, x: dir * 48 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -48 }}
            transition={{ type: "spring", stiffness: 260, damping: 32 }}
            className="absolute inset-0 cursor-grab touch-pan-y active:cursor-grabbing"
          >
            <Slide slide={current} theme={deck.theme ?? "amber"} />
          </motion.div>
        </AnimatePresence>

        {/* Кнопки навигации поверх сцены (на десктопе — по краям) */}
        <button
          aria-label="Предыдущий слайд"
          onClick={prev}
          disabled={index === 0}
          className="absolute left-2 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-foreground/10 bg-background/80 p-2 text-foreground/70 shadow-sm backdrop-blur transition hover:bg-background disabled:opacity-0 sm:block"
        >
          <ChevronLeft className="size-5" />
        </button>
        <button
          aria-label="Следующий слайд"
          onClick={next}
          disabled={index === total - 1}
          className="absolute right-2 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-foreground/10 bg-background/80 p-2 text-foreground/70 shadow-sm backdrop-blur transition hover:bg-background disabled:opacity-0 sm:block"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      {/* Панель управления */}
      <div className="flex items-center justify-between gap-3 border-t border-foreground/10 px-3 py-2.5">
        {/* Кнопки prev/next (мобильный) */}
        <button
          aria-label="Предыдущий слайд"
          onClick={prev}
          disabled={index === 0}
          className="rounded-lg border border-foreground/15 p-1.5 text-foreground/70 transition hover:bg-foreground/5 disabled:opacity-30 sm:hidden"
        >
          <ChevronLeft className="size-4" />
        </button>

        {/* Точки-навигация */}
        <div className="flex flex-1 items-center justify-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              aria-label={`Слайд ${i + 1}`}
              onClick={() => go(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? `w-5 ${theme.dot}` : "w-1.5 bg-foreground/20 hover:bg-foreground/40"
              }`}
            />
          ))}
        </div>

        <button
          aria-label="Следующий слайд"
          onClick={next}
          disabled={index === total - 1}
          className="rounded-lg border border-foreground/15 p-1.5 text-foreground/70 transition hover:bg-foreground/5 disabled:opacity-30 sm:hidden"
        >
          <ChevronRight className="size-4" />
        </button>

        <span className="hidden text-xs tabular-nums text-foreground/50 sm:inline">
          {index + 1} / {total}
        </span>
        <button
          aria-label={fs ? "Выйти из полноэкранного режима" : "Полный экран"}
          onClick={toggleFs}
          className="hidden rounded-lg border border-foreground/15 p-1.5 text-foreground/70 transition hover:bg-foreground/5 sm:block"
        >
          {fs ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </button>
      </div>
    </div>
  );
}

/** Один слайд по его layout. */
function Slide({ slide, theme }: { slide: DeckSlide; theme: DeckTheme }) {
  const t = THEMES[theme];

  if (slide.layout === "cover") {
    return (
      <div className={`flex h-full flex-col justify-center bg-gradient-to-br ${t.grad} p-7 text-white sm:p-12`}>
        {slide.kicker ? (
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/75 sm:text-sm">
            {slide.kicker}
          </p>
        ) : null}
        <h2 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
          {slide.title}
        </h2>
        {slide.subtitle ? (
          <p className="mt-4 max-w-2xl text-base text-white/85 sm:text-xl">{slide.subtitle}</p>
        ) : null}
      </div>
    );
  }

  if (slide.layout === "quote") {
    return (
      <div className="flex h-full flex-col justify-center p-7 sm:p-12">
        <Quote className={`mb-4 size-9 ${t.accent} opacity-40`} />
        <p className="text-xl font-semibold leading-snug sm:text-3xl">{slide.text}</p>
        {slide.caption ? (
          <p className="mt-4 text-sm text-foreground/55 sm:text-base">{slide.caption}</p>
        ) : null}
      </div>
    );
  }

  if (slide.layout === "outro") {
    return (
      <div className={`flex h-full flex-col items-center justify-center bg-gradient-to-br ${t.grad} p-7 text-center text-white sm:p-12`}>
        <h2 className="text-2xl font-extrabold tracking-tight sm:text-4xl">{slide.title}</h2>
        {slide.subtitle ? (
          <p className="mt-4 max-w-xl text-base text-white/85 sm:text-lg">{slide.subtitle}</p>
        ) : null}
      </div>
    );
  }

  if (slide.layout === "split") {
    return (
      <div className="flex h-full flex-col p-6 sm:p-10">
        <h3 className="text-lg font-bold tracking-tight sm:text-2xl">{slide.title}</h3>
        <div className="mt-4 grid flex-1 gap-3 sm:mt-6 sm:grid-cols-2 sm:gap-5">
          <SplitColumn col={slide.left} accent={t.accent} />
          <SplitColumn col={slide.right} accent={t.accent} />
        </div>
      </div>
    );
  }

  // list
  return (
    <div className="flex h-full flex-col p-6 sm:p-10">
      <h3 className="text-lg font-bold tracking-tight sm:text-2xl">{slide.title}</h3>
      {slide.intro ? (
        <p className="mt-2 text-sm text-foreground/60 sm:text-base">{slide.intro}</p>
      ) : null}
      <ul className="mt-4 flex flex-1 flex-col justify-center gap-2.5 sm:mt-6 sm:gap-3.5">
        {slide.items.map((item, i) => (
          <li key={i} className="flex items-start gap-3">
            {slide.numbered ? (
              <span
                className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg ${t.ring} text-sm font-bold text-white sm:size-8`}
              >
                {i + 1}
              </span>
            ) : (
              <span className={`mt-2 size-2 shrink-0 rounded-full ${t.ring}`} />
            )}
            <span className="text-sm leading-snug text-foreground/85 sm:text-lg">
              {item.lead ? <strong className="font-semibold text-foreground">{item.lead} </strong> : null}
              {item.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SplitColumn({
  col,
  accent,
}: {
  col: { heading: string; tone?: "good" | "bad" | "neutral"; items: string[] };
  accent: string;
}) {
  const tone = col.tone ?? "neutral";
  const styles =
    tone === "good"
      ? "border-emerald-500/25 bg-emerald-500/[0.06]"
      : tone === "bad"
        ? "border-rose-500/25 bg-rose-500/[0.06]"
        : "border-foreground/10 bg-foreground/[0.03]";
  const Icon = tone === "good" ? Check : tone === "bad" ? X : null;
  const iconColor = tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-rose-600" : accent;

  return (
    <div className={`flex flex-col rounded-xl border p-4 sm:p-5 ${styles}`}>
      <p className="mb-2.5 flex items-center gap-1.5 text-sm font-bold sm:text-base">
        {Icon ? <Icon className={`size-4 ${iconColor}`} /> : null}
        {col.heading}
      </p>
      <ul className="space-y-1.5">
        {col.items.map((it, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-foreground/80 sm:text-base">
            <span className={`mt-2 size-1.5 shrink-0 rounded-full ${iconColor.replace("text-", "bg-")}`} />
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
