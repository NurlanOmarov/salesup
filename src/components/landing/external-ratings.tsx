"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Сводные оценки школы на внешних площадках — раскладка в духе Booking:
 * крупная цифра в плашке, рядом словесная оценка и площадка со ссылкой.
 * Читатель за секунду видит «сколько» и куда пойти проверить.
 *
 * Разметку AggregateRating не даём: оценка собрана на чужих площадках, и
 * поисковики считают такую разметку самонакрученной.
 */
export interface ExternalRating {
  source: "yandex" | "google";
  label: string;
  href: string;
  rating: number;
  reviews: number | null;
}

/** Словесная оценка — как «Превосходно» у Booking рядом с числом. */
function verdict(rating: number, words: RatingWords): string {
  if (rating >= 4.8) return words.superb;
  if (rating >= 4.3) return words.excellent;
  if (rating >= 3.8) return words.good;
  return words.fine;
}

export interface RatingWords {
  superb: string;
  excellent: string;
  good: string;
  fine: string;
  reviews: string;
}

export function ExternalRatings({
  items,
  words,
}: {
  items: ExternalRating[];
  words: RatingWords;
}) {
  const reduce = useReducedMotion();
  if (items.length === 0) return null;

  return (
    <ul className="flex flex-wrap justify-center gap-3">
      {items.map((item, i) => (
        <motion.li
          key={item.source}
          initial={reduce ? false : { opacity: 0, y: 10 }}
          whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.4, delay: i * 0.08 }}
        >
          <a
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-2xl border border-foreground/10 bg-background p-3 pr-5 transition-colors hover:border-brand/40"
          >
            {/* Плашка с оценкой: тот самый «квадрат с цифрой», по которому
                узнают формат Booking. Скруглён с одного угла — фирменная деталь. */}
            <span className="flex size-12 items-center justify-center rounded-xl rounded-bl-sm bg-brand text-lg font-bold tabular-nums text-white">
              {item.rating.toFixed(1)}
            </span>
            <span className="text-left">
              <span className="block text-sm font-semibold">
                {verdict(item.rating, words)}
              </span>
              <span className="block text-xs text-foreground/55">
                {item.label}
                {item.reviews ? ` · ${item.reviews} ${words.reviews}` : ""}
              </span>
            </span>
          </a>
        </motion.li>
      ))}
    </ul>
  );
}
