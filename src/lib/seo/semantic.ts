import "server-only";
import { db } from "@/lib/db";
import { embedDocuments } from "@/lib/ai/embeddings";

/**
 * Семантический SEO-анализ на эмбеддингах (OpenAI text-embedding-3-small, D-001).
 * Курсовых векторов в БД нет (эмбеддится транскрипт по чанкам), а курсов немного —
 * поэтому считаем эмбеддинг «SEO-текста» каждого курса на лету батчем и сравниваем
 * cosine в JS. Вызывается по кнопке (контроль расхода API — правило 10), не на каждый
 * рендер. Расход токенов пишется в LlmUsage внутри embedDocuments.
 *
 * Две фичи:
 *   • каннибализация — пары курсов, чьи метаданные слишком похожи (конкурируют в SERP);
 *   • перелинковка — ближайшие по смыслу курсы (блок «связанные»).
 */

/** Порог косинусной близости, выше которого считаем курсы конкурирующими за запрос. */
export const CANNIBAL_THRESHOLD = 0.86;

interface CourseSeoRow {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  focusKeyword: string | null;
  description: string;
}

/** Текст, представляющий курс для SEO-сравнения (то, за что он ранжируется). */
function courseSeoText(c: CourseSeoRow): string {
  return [
    c.seoTitle ?? c.title,
    c.focusKeyword ?? "",
    c.seoDescription ?? c.subtitle ?? "",
    c.description.slice(0, 500),
  ]
    .filter(Boolean)
    .join(". ");
}

/** Косинусная близость двух векторов. */
export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    na += ai * ai;
    nb += bi * bi;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export interface CannibalPair {
  a: { id: string; slug: string; title: string };
  b: { id: string; slug: string; title: string };
  similarity: number; // 0..1
}

export interface CannibalReport {
  courseCount: number;
  pairs: CannibalPair[];
}

async function publishedCoursesForSeo(): Promise<CourseSeoRow[]> {
  return db.course.findMany({
    where: { status: "PUBLISHED" },
    select: {
      id: true,
      slug: true,
      title: true,
      subtitle: true,
      seoTitle: true,
      seoDescription: true,
      focusKeyword: true,
      description: true,
    },
  });
}

/**
 * Найти пары опубликованных курсов, конкурирующих за один поисковый интент
 * (cosine ≥ порог). Пусто → каннибализации нет. При < 2 курсах анализ не нужен.
 */
export async function analyzeCannibalization(
  threshold = CANNIBAL_THRESHOLD,
): Promise<CannibalReport> {
  const courses = await publishedCoursesForSeo();
  if (courses.length < 2) return { courseCount: courses.length, pairs: [] };

  const vectors = await embedDocuments(courses.map(courseSeoText));

  const pairs: CannibalPair[] = [];
  for (let i = 0; i < courses.length; i++) {
    const ci = courses[i];
    const vi = vectors[i];
    if (!ci || !vi) continue;
    for (let j = i + 1; j < courses.length; j++) {
      const cj = courses[j];
      const vj = vectors[j];
      if (!cj || !vj) continue;
      const sim = cosine(vi, vj);
      if (sim >= threshold) {
        pairs.push({
          a: { id: ci.id, slug: ci.slug, title: ci.title },
          b: { id: cj.id, slug: cj.slug, title: cj.title },
          similarity: sim,
        });
      }
    }
  }
  pairs.sort((x, y) => y.similarity - x.similarity);
  return { courseCount: courses.length, pairs };
}

export interface RelatedCourse {
  id: string;
  slug: string;
  title: string;
  similarity: number;
}

/**
 * Ближайшие по смыслу курсы к заданному (для блока «связанные» / перелинковки).
 * limit — сколько вернуть. Возвращает [] если курсов мало / курс не найден.
 */
export async function relatedCourses(
  courseId: string,
  limit = 4,
): Promise<RelatedCourse[]> {
  const courses = await publishedCoursesForSeo();
  const idx = courses.findIndex((c) => c.id === courseId);
  if (idx === -1 || courses.length < 2) return [];

  const vectors = await embedDocuments(courses.map(courseSeoText));
  const base = vectors[idx];
  if (!base) return [];

  return courses
    .map((c, i) => {
      const v = vectors[i];
      return {
        id: c.id,
        slug: c.slug,
        title: c.title,
        similarity: v ? cosine(base, v) : 0,
      };
    })
    .filter((_, i) => i !== idx)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}
