import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { relatedCourses } from "./semantic.js";

/**
 * Связанные курсы для публичной страницы (перелинковка, аудит п.6).
 * Семантический подбор (embeddings) дорогой — кэшируем на сутки per-курс; при сбое
 * эмбеддингов деградируем до «другие опубликованные курсы» (блок живёт всегда).
 * Публичный рендер НЕ должен зависеть от доступности OpenAI (правило 2/10).
 */

export interface RelatedCard {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  industry: string | null;
  coverUrl: string | null;
  coverAlt: string | null;
}

async function fallbackCourses(courseId: string, limit: number): Promise<string[]> {
  const rows = await db.course.findMany({
    where: { status: "PUBLISHED", id: { not: courseId } },
    orderBy: { sortOrder: "asc" },
    take: limit,
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

const cachedRelatedIds = (courseId: string) =>
  unstable_cache(
    async (): Promise<string[]> => {
      try {
        const related = await relatedCourses(courseId, 3);
        if (related.length > 0) return related.map((r) => r.id);
      } catch (err) {
        console.warn("[related] embeddings недоступны, фолбэк:", (err as Error).message);
      }
      return fallbackCourses(courseId, 3);
    },
    ["related-courses", courseId],
    { revalidate: 86400, tags: ["related-courses"] },
  )();

/** Карточки связанных курсов (до 3) для страницы курса. */
export async function getRelatedCards(courseId: string): Promise<RelatedCard[]> {
  const ids = await cachedRelatedIds(courseId);
  if (ids.length === 0) return [];
  const rows = await db.course.findMany({
    where: { id: { in: ids }, status: "PUBLISHED" },
    select: {
      id: true,
      slug: true,
      title: true,
      subtitle: true,
      industry: true,
      coverUrl: true,
      coverAlt: true,
    },
  });
  // сохранить порядок по близости
  const order = new Map(ids.map((id, i) => [id, i]));
  return rows.sort((a, b) => (order.get(a.id) ?? 9) - (order.get(b.id) ?? 9));
}
