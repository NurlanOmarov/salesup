"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Пословное появление заголовка hero (стиль премиальных продуктовых сайтов).
 * При prefers-reduced-motion — обычный статичный заголовок.
 */
export function AnimatedTitle({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <h1 className={className}>{text}</h1>;

  const words = text.split(" ");
  return (
    <h1 className={className} aria-label={text}>
      {words.map((w, i) => (
        <span key={i}>
          <span className="inline-block overflow-hidden align-bottom">
            <motion.span
              className="inline-block"
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{
                duration: 0.5,
                delay: 0.15 + i * 0.07,
                ease: [0.22, 1, 0.36, 1],
              }}
              aria-hidden
            >
              {w}
            </motion.span>
          </span>
          {i < words.length - 1 ? " " : null}
        </span>
      ))}
    </h1>
  );
}
