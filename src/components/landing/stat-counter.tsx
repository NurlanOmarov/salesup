"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "framer-motion";

/** Число с форматированием по-русски: 5000 → «5 000». */
function fmt(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(n);
}

/** Анимированный счётчик: считает от 0 до value при появлении в зоне видимости. */
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
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setDisplay(value);
      return;
    }
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
        {fmt(display)}
        <span className="text-brand-light">{suffix}</span>
      </div>
      <div className="mt-1 text-sm text-white/60">{label}</div>
    </div>
  );
}
