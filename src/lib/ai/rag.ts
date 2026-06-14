import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { toVectorLiteral } from "./embeddings.js";

/**
 * Гибридный поиск релевантных фрагментов транскриптов (RAG, S7.1).
 * Объединяет два сигнала через Reciprocal Rank Fusion (RRF):
 *   • полнотекст Postgres (to_tsvector russian + ts_rank) — точные слова/термины;
 *   • вектор Voyage (pgvector cosine `<=>`) — смысловая близость.
 * Если эмбеддинг запроса недоступен (нет ключа/Voyage недоступен/чанки не векторизованы),
 * деградирует до чистого полнотекста — интерфейс searchChunks при этом не меняется.
 */

export interface RetrievedChunk {
  id: string;
  lessonId: string;
  text: string;
  rank: number;
}

interface ScoredId {
  id: string;
  lessonId: string;
  text: string;
}

/** Кандидатов из каждого источника тянем с запасом — fusion отберёт лучшие. */
const CANDIDATE_POOL = 12;
/** Константа RRF (стандартная k=60): сглаживает вклад нижних позиций. */
const RRF_K = 60;

/**
 * Reciprocal Rank Fusion: score(doc) = Σ 1/(k + rank_в_списке).
 * Чистая функция (тестируется отдельно). Возвращает id в порядке убывания score.
 */
export function reciprocalRankFusion(
  lists: string[][],
  k = RRF_K,
): { id: string; score: number }[] {
  const scores = new Map<string, number>();
  for (const list of lists) {
    list.forEach((id, idx) => {
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + idx + 1));
    });
  }
  return [...scores.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}

function termsOf(query: string): string[] {
  return (query.toLowerCase().match(/[a-zа-яё]{3,}/gi) ?? []).slice(0, 12);
}

async function fullTextCandidates(
  query: string,
  scope: { courseIds: string[]; lessonId?: string },
): Promise<ScoredId[]> {
  const terms = termsOf(query);
  if (terms.length === 0) return [];
  const tsquery = terms.join(" | ");
  const lessonFilter = scope.lessonId
    ? Prisma.sql`AND "lessonId" = ${scope.lessonId}`
    : Prisma.empty;

  return db.$queryRaw<ScoredId[]>(Prisma.sql`
    SELECT id, "lessonId", text
    FROM "TranscriptChunk"
    WHERE "courseId" IN (${Prisma.join(scope.courseIds)})
      ${lessonFilter}
      AND to_tsvector('russian', text) @@ to_tsquery('russian', ${tsquery})
    ORDER BY ts_rank(to_tsvector('russian', text), to_tsquery('russian', ${tsquery})) DESC
    LIMIT ${CANDIDATE_POOL}
  `);
}

async function vectorCandidates(
  queryEmbedding: number[],
  scope: { courseIds: string[]; lessonId?: string },
): Promise<ScoredId[]> {
  const vec = toVectorLiteral(queryEmbedding);
  const lessonFilter = scope.lessonId
    ? Prisma.sql`AND "lessonId" = ${scope.lessonId}`
    : Prisma.empty;

  return db.$queryRaw<ScoredId[]>(Prisma.sql`
    SELECT id, "lessonId", text
    FROM "TranscriptChunk"
    WHERE "courseId" IN (${Prisma.join(scope.courseIds)})
      ${lessonFilter}
      AND embedding IS NOT NULL
    ORDER BY embedding <=> ${vec}::vector
    LIMIT ${CANDIDATE_POOL}
  `);
}

/**
 * Найти топ-K фрагментов по запросу в рамках курсов (и опционально урока).
 * Ограничение по courseIds критично: ученик получает контекст только из своих курсов.
 *
 * opts.queryEmbedding — заранее посчитанный вектор запроса (chat.ts считает его один
 * раз и переиспользует для уроко- и курсо-скоупа). Если не передан → только полнотекст.
 */
export async function searchChunks(
  query: string,
  scope: { courseIds: string[]; lessonId?: string },
  limit = 6,
  opts: { queryEmbedding?: number[] | null } = {},
): Promise<RetrievedChunk[]> {
  if (scope.courseIds.length === 0 || !query.trim()) return [];

  const [ftRows, vecRows] = await Promise.all([
    fullTextCandidates(query, scope),
    opts.queryEmbedding && opts.queryEmbedding.length > 0
      ? vectorCandidates(opts.queryEmbedding, scope)
      : Promise.resolve<ScoredId[]>([]),
  ]);

  // Без вектора — отдаём полнотекст как раньше (порядок ts_rank сохранён).
  if (vecRows.length === 0) {
    return ftRows.slice(0, limit).map((r, i) => ({ ...r, rank: 1 / (i + 1) }));
  }

  const byId = new Map<string, ScoredId>();
  for (const r of [...ftRows, ...vecRows]) byId.set(r.id, r);

  const fused = reciprocalRankFusion([
    ftRows.map((r) => r.id),
    vecRows.map((r) => r.id),
  ]);

  return fused.slice(0, limit).map(({ id, score }) => {
    const row = byId.get(id)!;
    return { id, lessonId: row.lessonId, text: row.text, rank: score };
  });
}
