"use client";

import { useReducedMotion } from "framer-motion";
import { Star } from "lucide-react";

/**
 * Лента реальных отзывов с Яндекс и Google Карт — «титрами», как бегущая
 * строка отраслей (та же механика: список дублируется для бесшовного цикла,
 * пауза при наведении, при prefers-reduced-motion — обычная сетка).
 *
 * Тексты переносит владелец через /admin/reviews: автопарсинг карт нарушает их
 * условия и ломается при смене вёрстки. У каждой карточки — автор, площадка и
 * ссылка на первоисточник, чтобы отзыв можно было проверить.
 */
export interface ExternalReviewCard {
  id: string;
  author: string;
  text: string;
  /** 1–5, если оценка известна: у своих отзывов есть всегда, у карт — не всегда. */
  rating: number | null;
  source: "PLATFORM" | "YANDEX" | "GOOGLE" | "OTHER";
  url: string | null;
}

const SOURCE_LABEL: Record<ExternalReviewCard["source"], string> = {
  PLATFORM: "Отзыв ученика",
  YANDEX: "Яндекс Карты",
  GOOGLE: "Google Карты",
  OTHER: "Отзыв",
};

function Card({ review, hidden }: { review: ExternalReviewCard; hidden?: boolean }) {
  // Раскладка в духе Booking: плашка с оценкой, цитата, автор с инициалом внизу.
  const initial = review.author.trim().charAt(0).toUpperCase() || "?";
  const body = (
    <div className="flex h-full w-72 shrink-0 flex-col rounded-2xl border border-foreground/10 bg-background p-4 text-left transition-colors hover:border-brand/40 sm:w-80">
      <div className="flex items-center justify-between gap-2">
        {/* Звёзды — где оценка известна (свои отзывы). В выгрузке с карт оценки
            нет, и вместо неё карточка показывает только площадку: выдумывать
            пять звёзд нельзя. */}
        {review.rating ? (
          <span className="flex gap-0.5" aria-label={`Оценка ${review.rating} из 5`}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                aria-hidden
                className={
                  n <= review.rating!
                    ? "size-3.5 fill-amber-400 text-amber-400"
                    : "size-3.5 text-foreground/20"
                }
              />
            ))}
          </span>
        ) : (
          <span />
        )}
        <span className="text-xs text-foreground/45">{SOURCE_LABEL[review.source]}</span>
      </div>

      <p className="mt-3 line-clamp-6 flex-1 text-sm leading-relaxed text-foreground/75">
        «{review.text}»
      </p>

      <div className="mt-4 flex items-center gap-2 border-t border-foreground/8 pt-3">
        <span className="flex size-7 items-center justify-center rounded-full bg-foreground/8 text-xs font-semibold text-foreground/70">
          {initial}
        </span>
        <span className="text-xs font-medium text-foreground/70">{review.author}</span>
      </div>
    </div>
  );

  return review.url ? (
    <a
      href={review.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-hidden={hidden}
      tabIndex={hidden ? -1 : undefined}
    >
      {body}
    </a>
  ) : (
    <div aria-hidden={hidden}>{body}</div>
  );
}

export function ExternalReviewsMarquee({ items }: { items: ExternalReviewCard[] }) {
  const reduce = useReducedMotion();
  if (items.length === 0) return null;

  if (reduce) {
    return (
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((r) => (
          <Card key={r.id} review={r} />
        ))}
      </div>
    );
  }

  const doubled = [...items, ...items];
  return (
    <div className="marquee relative mt-6 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
      <div className="marquee-track flex w-max items-stretch gap-3 pr-3">
        {doubled.map((r, i) => (
          <Card key={`${r.id}-${i}`} review={r} hidden={i >= items.length} />
        ))}
      </div>
    </div>
  );
}
