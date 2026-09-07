"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "framer-motion";

/** Число с форматированием по-русски: 5000 → «5 000». */
function fmt(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(n);
}

// На сервере useLayoutEffect не выполняется (и ругается в консоль) — берём его
// только в браузере: важно сбросить счётчик в 0 ДО первой отрисовки, иначе
// значение мигнёт с конечного на нулевое.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Анимированный счётчик: считает от 0 до value при появлении в зоне видимости.
 *
 * В HTML (SSR) сразу лежит конечное значение — текстовый краулер и читалка без
 * JS видят «20 лет опыта», а не «0». Обнуление и анимация происходят только в
 * браузере, после гидратации.
 */
export function StatCounter({
  value,
  suffix,
  label,
}: {
  value: number;
  suffix: string;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const reduce = useReducedMotion();
  // null — «анимация ещё не началась», показываем конечное значение из SSR.
  const [display, setDisplay] = useState<number | null>(null);

  useIsoLayoutEffect(() => {
    if (reduce) return;
    setDisplay(0);
  }, [reduce]);

  useEffect(() => {
    if (!inView || reduce) return;
    const duration = 1200;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      // ease-out cubic — быстро в начале, плавно в конце
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(eased * value));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduce, value]);

  return (
    <div ref={ref} className="text-center">
      <div className="text-3xl font-bold tabular-nums text-white sm:text-4xl">
        {fmt(display ?? value)}
        <span className="text-brand-light">{suffix}</span>
      </div>
      <div className="mt-1 text-sm text-white/60">{label}</div>
    </div>
  );
}
