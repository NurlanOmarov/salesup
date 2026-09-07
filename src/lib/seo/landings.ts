import "server-only";
import { unstable_cache, revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { buildSafe } from "@/lib/utils";

/**
 * SEO-посадочные (/obuchenie/<slug>) — страницы под кластеры поисковых запросов.
 *
 * Курсов девять, а коммерческих намерений сотни: «работа с возражениями»,
 * «обучение руководителя отдела продаж», «продажи новостроек». Каждому кластеру
 * нужна своя страница с собственным ответом, иначе весь трафик пытается сесть
 * на девять карточек курсов и не садится никуда.
 *
 * Тексты пишет владелец в /admin/seo/landings; страница ведёт на профильный
 * курс. Дублей не делаем: одна страница = одно намерение (docs/SEO-LANDINGS.md).
 */

export const SEO_LANDINGS_TAG = "seo-landings";

export interface LandingFaqItem {
  q: string;
  a: string;
}

/** FAQ хранится как Json — приводим к массиву пар, молча отбрасывая мусор. */
export function parseFaq(value: unknown): LandingFaqItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const q = (item as Record<string, unknown>).q;
    const a = (item as Record<string, unknown>).a;
    return typeof q === "string" && typeof a === "string" && q && a ? [{ q, a }] : [];
  });
}

const loadPublished = unstable_cache(
  async () =>
    buildSafe(
      () =>
        db.seoLanding.findMany({
          where: { published: true },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            slug: true,
            cluster: true,
            h1: true,
            description: true,
            noindex: true,
            updatedAt: true,
          },
        }),
      [],
    ),
  ["seo-landings-published"],
  { tags: [SEO_LANDINGS_TAG], revalidate: 300 },
);

export type LandingCard = Awaited<ReturnType<typeof loadPublished>>[number];

/** Опубликованные посадочные: карта сайта и перелинковка. */
export async function getPublishedLandings(): Promise<LandingCard[]> {
  return loadPublished();
}

/** Полная страница по slug; null — нет такой или снята с публикации. */
export async function getLanding(slug: string) {
  return buildSafe(
    () =>
      db.seoLanding.findFirst({
        where: { slug, published: true },
        include: {
          course: {
            select: {
              id: true,
              slug: true,
              title: true,
              subtitle: true,
              coverUrl: true,
              priceTiyn: true,
              status: true,
            },
          },
        },
      }),
    null,
  );
}

export function revalidateLandings(): void {
  revalidateTag(SEO_LANDINGS_TAG);
}
