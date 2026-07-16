// БЕЗ "server-only": модуль используется и worker-контейнером (digest.weekly, tsx),
// где этот guard бросает ошибку. В клиентский бандл не попадает — импортируется
// только из server actions и Job-обработчиков.
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

// ─────────────────────────── Match-score «ключ ↔ контент» ───────────────────────────

/**
 * Насколько целевой запрос семантически соответствует содержанию страницы (0..1).
 * Честная замена «плотности ключевых слов»: сравниваются смыслы, а не вхождения.
 */
export async function keywordMatch(
  focusKeyword: string,
  source: string,
): Promise<number> {
  const kw = focusKeyword.trim();
  const src = source.trim().slice(0, 4000);
  if (!kw || !src) return 0;
  const [kwVec, srcVec] = await embedDocuments([kw, src]);
  if (!kwVec || !srcVec) return 0;
  return cosine(kwVec, srcVec);
}

// ─────────────────────────── Кластеризация тем (карта покрытия) ───────────────────────────

/** Порог, при котором курсы считаются одной темой (мягче каннибализации). */
export const CLUSTER_THRESHOLD = 0.75;

export interface ThemeCluster {
  courses: { id: string; slug: string; title: string; focusKeyword: string | null }[];
}

export interface ClusterReport {
  clusters: ThemeCluster[]; // группы из ≥2 курсов — одна тема
  singles: ThemeCluster["courses"]; // курсы со своей уникальной темой
  noKeyword: ThemeCluster["courses"]; // без фокус-ключа (используется title)
}

/**
 * Сгруппировать опубликованные курсы по смысловым темам (фокус-ключ, иначе title).
 * Жадная кластеризация по cosine ≥ порога — курсов немного, этого достаточно.
 * Группы из нескольких курсов = конкуренция за тему; одиночки = уникальное покрытие.
 */
export async function keywordClusters(
  threshold = CLUSTER_THRESHOLD,
): Promise<ClusterReport> {
  const courses = await db.course.findMany({
    where: { status: "PUBLISHED" },
    select: { id: true, slug: true, title: true, focusKeyword: true },
  });
  const empty: ClusterReport = { clusters: [], singles: [], noKeyword: [] };
  if (courses.length === 0) return empty;

  const vectors = await embedDocuments(
    courses.map((c) => c.focusKeyword?.trim() || c.title),
  );

  // Жадное объединение: курс попадает в первый кластер, чей «якорь» достаточно близок.
  const assigned = new Array<number>(courses.length).fill(-1);
  const anchors: number[] = [];
  for (let i = 0; i < courses.length; i++) {
    const vi = vectors[i];
    if (!vi) continue;
    let placed = false;
    for (let a = 0; a < anchors.length; a++) {
      const va = vectors[anchors[a]!];
      if (va && cosine(vi, va) >= threshold) {
        assigned[i] = a;
        placed = true;
        break;
      }
    }
    if (!placed) {
      anchors.push(i);
      assigned[i] = anchors.length - 1;
    }
  }

  const groups = new Map<number, ThemeCluster["courses"]>();
  courses.forEach((c, i) => {
    const g = assigned[i] ?? -1;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push({ id: c.id, slug: c.slug, title: c.title, focusKeyword: c.focusKeyword });
  });

  const report: ClusterReport = { clusters: [], singles: [], noKeyword: [] };
  for (const list of groups.values()) {
    if (list.length >= 2) report.clusters.push({ courses: list });
    else if (list[0]) report.singles.push(list[0]);
  }
  report.noKeyword = courses
    .filter((c) => !c.focusKeyword?.trim())
    .map((c) => ({ id: c.id, slug: c.slug, title: c.title, focusKeyword: c.focusKeyword }));
  return report;
}
