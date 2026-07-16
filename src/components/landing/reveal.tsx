"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Появление блока при скролле. Лёгкая замена framer-motion: IntersectionObserver
 * + CSS-переход (меньше JS/стоимости гидратации на лендинге). Уважает
 * prefers-reduced-motion — при включённой настройке показывает сразу без анимации
 * (правило доступности CLAUDE.md/ТЗ §7).
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "-80px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "none" : "translateY(20px)",
        transition: `opacity 0.5s ease-out ${delay}s, transform 0.5s ease-out ${delay}s`,
        willChange: shown ? undefined : "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}
