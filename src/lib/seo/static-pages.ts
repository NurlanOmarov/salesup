import "server-only";
import { unstable_cache, revalidateTag } from "next/cache";
import type { StaticPageSeo } from "@prisma/client";
import { db } from "@/lib/db";
import { buildSafe } from "@/lib/utils";
import { REQUISITES_FILLED } from "@/content/legal";

/**
 * SEO статических публичных страниц из админки (раздел /admin/seo): каталог,
 * оферта, политика. Принцип тот же, что у SeoSettings: поле пустое → фолбэк
 * на захардкоженное значение страницы; заполнено → приоритет у ручного.
 * body (markdown) — текст оферты/политики: пусто → страница показывает редакцию
 * по умолчанию из src/content/legal.
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
    path: "/business",
    label: "Обучение для команды (B2B)",
    hasBody: false,
    defaultNoindex: false,
    fallbackTitle: "Корпоративное обучение отдела продаж",
    fallbackDescription:
      "Онлайн-обучение продажам для команды: доступ ко всем курсам на год, кабинет компании с отчётами по каждому сотруднику, AI-тренажёры. Сотрудники учатся обезличенно — их персональные данные мы не получаем.",
  },
  {
    path: "/offer",
    label: "Публичная оферта",
    hasBody: true,
    // Тексты живут в src/content/legal и показываются всегда; noindex остаётся
    // только пока в них плейсхолдеры вместо реквизитов ИП.
    defaultNoindex: !REQUISITES_FILLED,
    fallbackTitle: "Публичная оферта",
    fallbackDescription:
      "Договор на предоставление доступа к курсам ACTIVE SALES: предмет, оплата, доступ, возврат, права сторон.",
  },
  {
    path: "/offer-b2b",
    label: "Оферта для организаций",
    hasBody: true,
    defaultNoindex: !REQUISITES_FILLED,
    fallbackTitle: "Публичная оферта для организаций",
    fallbackDescription:
      "Условия корпоративного доступа к курсам ACTIVE SALES: места в лицензии, обезличивание сотрудников, расчёты и приёмка по акту.",
  },
  {
    path: "/privacy",
    label: "Политика обработки персональных данных",
    hasBody: true,
    defaultNoindex: !REQUISITES_FILLED,
    fallbackTitle: "Политика в отношении обработки персональных данных",
    fallbackDescription:
      "Какие персональные данные обрабатывает ACTIVE SALES, зачем, как долго хранит и как реализовать права субъекта по Закону № 99-З.",
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
