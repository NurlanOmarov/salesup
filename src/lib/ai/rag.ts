import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Поиск релевантных фрагментов транскриптов (RAG, S7.1). Сейчас — полнотекстовый
 * поиск Postgres (to_tsvector russian + ts_rank): не требует внешних эмбеддингов.
 * Когда появится Voyage-ключ, добавим векторный поиск по TranscriptChunk.embedding
 * с тем же интерфейсом (searchChunks) — вызывающий код не изменится.
 */

export interface RetrievedChunk {
  id: string;
  lessonId: string;
  text: string;
  rank: number;
}

/**
 * Найти топ-K фрагментов по запросу в рамках курсов (и опционально урока).
 * Ограничение по courseIds критично: ученик получает контекст только из своих курсов.
 */
export async function searchChunks(
  query: string,
  scope: { courseIds: string[]; lessonId?: string },
  limit = 6,
): Promise<RetrievedChunk[]> {
  if (scope.courseIds.length === 0 || !query.trim()) return [];

  // Ключевые слова запроса → OR-tsquery: совпадение по любому слову (а не по всем,
  // как plainto_tsquery), ранжирование ts_rank поднимает самые релевантные чанки.
  const terms = (query.toLowerCase().match(/[a-zа-яё]{3,}/gi) ?? []).slice(0, 12);
  if (terms.length === 0) return [];
  const tsquery = terms.join(" | ");

  const lessonFilter = scope.lessonId
    ? Prisma.sql`AND "lessonId" = ${scope.lessonId}`
    : Prisma.empty;

  const rows = await db.$queryRaw<RetrievedChunk[]>(Prisma.sql`
    SELECT id, "lessonId", text,
           ts_rank(to_tsvector('russian', text), to_tsquery('russian', ${tsquery})) AS rank
    FROM "TranscriptChunk"
    WHERE "courseId" IN (${Prisma.join(scope.courseIds)})
      ${lessonFilter}
      AND to_tsvector('russian', text) @@ to_tsquery('russian', ${tsquery})
    ORDER BY rank DESC
    LIMIT ${limit}
  `);
  return rows;
}
