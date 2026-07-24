import "server-only";
import { db } from "@/lib/db";

/**
 * Запись просмотра страницы в свою таблицу Event (источник истины — CLAUDE.md D-002).
 * Один name для всего публичного трафика; тип страницы различаем по meta.slug.
 * ПДн не пишем: только путь, ISO-страна, хост внешнего источника и анонимный
 * visitor-id (случайный, из localStorage; к личности не привязан).
 */

/** Имя события трафика в таблице Event. */
export const PAGE_VIEW = "page.view";

export type PageViewInput = {
  /** pathname без query (query может нести токены — не храним). */
  path: string;
  /** Анонимный идентификатор устройства для подсчёта уникальных посетителей. */
  visitorId: string;
  /** ISO-код страны или null. */
  country: string | null;
  /** Хост внешнего реферера (без пути/query) или null для прямых/внутренних заходов. */
  ref: string | null;
  /** slug курса, если это страница /courses/<slug> — иначе null. */
  slug: string | null;
};

export async function recordPageView(input: PageViewInput): Promise<void> {
  await db.event.create({
    data: {
      name: PAGE_VIEW,
      meta: {
        path: input.path,
        v: input.visitorId,
        ...(input.country ? { country: input.country } : {}),
        ...(input.ref ? { ref: input.ref } : {}),
        ...(input.slug ? { slug: input.slug } : {}),
      },
    },
  });
}
