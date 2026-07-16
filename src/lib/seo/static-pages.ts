import "server-only";
import { unstable_cache, revalidateTag } from "next/cache";
import type { StaticPageSeo } from "@prisma/client";
import { db } from "@/lib/db";
import { buildSafe } from "@/lib/utils";

/**
 * SEO статических публичных страниц из админки (раздел /admin/seo): каталог,
 * оферта, политика. Принцип тот же, что у SeoSettings: поле пустое → фолбэк
 * на захардкоженное значение страницы; заполнено → приоритет у ручного.
 * body (markdown) — текст thin-страниц: пока пусто, страница показывает
 * заглушку и остаётся noindex (аудит п.7).
 */

export const STATIC_SEO_TAG = "static-seo";

/** Известные страницы (единственный источник для админ-формы и валидации path). */
export const STATIC_PAGES = [
  {
    path: "/courses",
    label: "Каталог курсов",
    hasBody: false,
    defaultNoindex: false,
    fallbackTitle: "Каталог курсов",
    fallbackDescription:
      "Видеокурсы по продажам для туризма, мебели, обуви, недвижимости, медпредставителей и B2B. Авторские программы бизнес-тренера Виталия Дубовика.",
  },
  {
    path: "/offer",
    label: "Публичная оферта",
    hasBody: true,
    defaultNoindex: true,
    fallbackTitle: "Публичная оферта",
    fallbackDescription: "Условия использования платформы ACTIVE SALES.",
  },
  {
    path: "/privacy",
    label: "Политика конфиденциальности",
    hasBody: true,
    defaultNoindex: true,
    fallbackTitle: "Политика конфиденциальности",
    fallbackDescription:
      "Как Бизнес-платформа ACTIVE SALES обрабатывает персональные данные.",
  },
] as const;

export type StaticPagePath = (typeof STATIC_PAGES)[number]["path"];

export function isKnownStaticPage(path: string): path is StaticPagePath {
  return STATIC_PAGES.some((p) => p.path === path);
}

const load = unstable_cache(
  async (): Promise<StaticPageSeo[]> => {
    // На сборке без БД отдаём пусто — страницы используют фолбэки (см. buildSafe).
    return buildSafe(() => db.staticPageSeo.findMany(), []);
  },
  ["static-seo"],
  { tags: [STATIC_SEO_TAG], revalidate: 300 },
);

/** Все сохранённые override-строки (для админ-формы). */
export async function getStaticPageRows(): Promise<StaticPageSeo[]> {
  return load();
}

export interface ResolvedStaticSeo {
  title: string;
  description: string;
  noindex: boolean;
  body: string | null;
}

/**
 * Эффективные метаданные страницы: ручное значение либо фолбэк. noindex для
 * thin-страниц по умолчанию включён, пока владелец явно не снимет его в админке.
 */
export async function getStaticPageSeo(path: StaticPagePath): Promise<ResolvedStaticSeo> {
  const def = STATIC_PAGES.find((p) => p.path === path)!;
  const row = (await load()).find((r) => r.path === path);
  return {
    title: row?.title || def.fallbackTitle,
    description: row?.description || def.fallbackDescription,
    noindex: row ? row.noindex : def.defaultNoindex,
    body: row?.body || null,
  };
}

/** Сбросить кэш после сохранения в админке. */
export function revalidateStaticPageSeo() {
  revalidateTag(STATIC_SEO_TAG);
}
