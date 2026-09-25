"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, MessageSquareQuote, Star } from "lucide-react";
import { Link } from "@/components/i18n/link";
import { useLocale } from "@/i18n/client";
import { messagesFor } from "@/i18n/messages";

export interface CatalogReview {
  id: string;
  courseId: string;
  userName: string;
  rating: number;
  text: string;
}

/** Название и адрес курса — из карточек каталога: там они уже на языке витрины. */
export type ReviewCourse = { slug: string; title: string };

const AUTO_MS = 7000;

/**
 * Плитка отзывов учеников в сетке каталога — после «Не нашли своей темы?».
 * Одна плитка с перелистыванием, а не отдельная лента: сетка из 3 колонок почти
 * всегда оставляет пустую ячейку, и отзыв закрывает её там, где человек решает.
 * Отзывы — со всех курсов; у каждого ссылка на курс, о котором он написан.
 */
export function CatalogReviews({
  reviews,
  courses,
}: {
  reviews: CatalogReview[];
  courses: Map<string, ReviewCourse>;
}) {
  const t = messagesFor(useLocale());
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = reviews.length;

  // Фильтр каталога меняет порядок отзывов — начинаем с первого.
  useEffect(() => setIndex(0), [reviews]);

  useEffect(() => {
    if (count < 2 || paused || reduceMotion) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), AUTO_MS);
    return () => clearInterval(id);
  }, [count, paused, reduceMotion]);

  const r = reviews[index % count];
  if (!r) return null;
  const course = courses.get(r.courseId);
  const initial = r.userName.trim().charAt(0).toUpperCase() || "?";
  const go = (step: number) => setIndex((i) => (i + step + count) % count);

  return (
    <section
      aria-label={t.catalog.reviewsTitle}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="flex h-full min-h-72 flex-col rounded-2xl border border-foreground/10 bg-background p-6"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground/70">
          <MessageSquareQuote className="size-4 text-brand" aria-hidden />
          {t.catalog.reviewsTitle}
        </h2>
        {count > 1 ? (
          <span className="text-xs tabular-nums text-foreground/40">
            {(index % count) + 1} / {count}
          </span>
        ) : null}
      </div>

      <figure key={r.id} className="mt-4 flex flex-1 flex-col">
        <span className="flex gap-0.5" role="img" aria-label={`Оценка ${r.rating} из 5`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              aria-hidden
              className={
                n <= r.rating ? "size-4 fill-amber-400 text-amber-400" : "size-4 text-foreground/20"
              }
            />
          ))}
        </span>
        <blockquote className="mt-3 line-clamp-[8] flex-1 leading-relaxed text-foreground/80">
          «{r.text}»
        </blockquote>
        <figcaption className="mt-4 flex items-center gap-2 border-t border-foreground/8 pt-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground/8 text-xs font-semibold text-foreground/70">
            {initial}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{r.userName}</span>
            {course ? (
              <Link
                href={`/courses/${course.slug}`}
                className="block truncate text-xs text-foreground/50 hover:text-brand"
              >
                {course.title}
              </Link>
            ) : null}
          </span>
        </figcaption>
      </figure>

      {count > 1 ? (
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label={t.catalog.reviewsPrev}
            className="flex size-9 items-center justify-center rounded-full border border-foreground/15 text-foreground/60 transition-colors hover:border-brand/40 hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label={t.catalog.reviewsNext}
            className="flex size-9 items-center justify-center rounded-full border border-foreground/15 text-foreground/60 transition-colors hover:border-brand/40 hover:text-foreground"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      ) : null}
    </section>
  );
}
