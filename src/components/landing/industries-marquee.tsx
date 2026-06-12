"use client";

import { useReducedMotion } from "framer-motion";

/**
 * Бегущая лента отраслей. Список дублируется для бесшовного цикла,
 * пауза при наведении; при prefers-reduced-motion — статичная сетка чипов.
 */
export function IndustriesMarquee({ items }: { items: readonly string[] }) {
  const reduce = useReducedMotion();

  if (reduce) {
    return (
      <div className="flex flex-wrap justify-center gap-3">
        {items.map((name) => (
          <span
            key={name}
            className="rounded-full border border-foreground/15 bg-background px-4 py-2 text-sm font-medium"
          >
            {name}
          </span>
        ))}
      </div>
    );
  }

  const doubled = [...items, ...items];
  return (
    <div className="marquee relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
      <div className="marquee-track flex w-max gap-3 pr-3">
        {doubled.map((name, i) => (
          <span
            key={`${name}-${i}`}
            aria-hidden={i >= items.length}
            className="whitespace-nowrap rounded-full border border-foreground/15 bg-background px-5 py-2.5 text-sm font-medium transition-colors hover:border-amber-500/50 hover:text-amber-600"
          >
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}
