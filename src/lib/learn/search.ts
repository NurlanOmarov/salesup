import { db } from "@/lib/db";
import { searchChunks } from "@/lib/ai/rag";
import { embedQuery } from "@/lib/ai/embeddings";

/**
 * Глобальный поиск по материалам курсов ученика поверх готовых эмбеддингов
 * (гибрид полнотекст + вектор, как у AI-наставника). Возвращает фрагменты
 * транскриптов с привязкой к уроку и таймкоду — клик ведёт прямо к моменту видео.
 * Область поиска ограничена курсами с активным доступом (CLAUDE.md, правило 1/4).
 */

export interface SearchHit {
  lessonId: string;
  lessonTitle: string;
  courseSlug: string;
  courseTitle: string;
  startSec: number;
  snippet: string;
}

async function activeCourseIds(userId: string, now: Date): Promise<string[]> {
  const enrollments = await db.enrollment.findMany({
    where: {
      userId,
      revokedAt: null,
      startsAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { courseId: true },
  });
  return enrollments.map((e) => e.courseId);
}

export async function searchLessons(
  userId: string,
  query: string,
  limit = 12,
): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const courseIds = await activeCourseIds(userId, new Date());
  if (courseIds.length === 0) return [];

  const queryEmbedding = await embedQuery(q).catch(() => null);
  const chunks = await searchChunks(q, { courseIds }, limit, { queryEmbedding });
  if (chunks.length === 0) return [];

  // Подтягиваем таймкод фрагмента (TranscriptChunk хранит lessonId денормализованно,
  // без relation) и отдельно — метаданные уроков.
  const rows = await db.transcriptChunk.findMany({
    where: { id: { in: chunks.map((c) => c.id) } },
    select: { id: true, startSec: true, text: true, lessonId: true },
  });
  const chunkById = new Map(rows.map((r) => [r.id, r]));

  const lessons = await db.lesson.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.lessonId))] } },
    select: {
      id: true,
      title: true,
      status: true,
      module: { select: { course: { select: { slug: true, title: true } } } },
    },
  });
  const lessonById = new Map(lessons.map((l) => [l.id, l]));

  const hits: SearchHit[] = [];
  for (const c of chunks) {
    const row = chunkById.get(c.id);
    if (!row) continue;
    const lesson = lessonById.get(row.lessonId);
    if (!lesson || lesson.status !== "PUBLISHED") continue;
    hits.push({
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      courseSlug: lesson.module.course.slug,
      courseTitle: lesson.module.course.title,
      startSec: row.startSec,
      snippet: makeSnippet(row.text),
    });
  }
  return hits;
}

/** Короткий сниппет результата (первые ~220 символов по границе слова). */
function makeSnippet(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= 220) return clean;
  const cut = clean.slice(0, 220);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 120 ? lastSpace : 220)}…`;
}
