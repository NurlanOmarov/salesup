"use client";

import { Star } from "lucide-react";

export interface ReviewItem {
  id: string;
  userName: string;
  rating: number;
  text: string;
}

/** Карусель отзывов (горизонтальный скролл со снэпом — лёгкий, без внешних либ). */
export function Reviews({ items }: { items: ReviewItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((r) => (
        <figure
          key={r.id}
          className="w-[85%] shrink-0 snap-start rounded-2xl border border-foreground/10 p-6 sm:w-[360px]"
        >
          <div
            className="flex gap-0.5"
            role="img"
            aria-label={`Оценка ${r.rating} из 5`}
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={
                  i < r.rating
                    ? "size-4 fill-amber-400 text-amber-400"
                    : "size-4 text-foreground/20"
                }
              />
            ))}
          </div>
          <blockquote className="mt-3 text-foreground/80">{r.text}</blockquote>
          <figcaption className="mt-4 text-sm font-medium text-foreground/60">
            {r.userName}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
