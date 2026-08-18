import "server-only";
import { unstable_cache, revalidateTag } from "next/cache";
import type { StaticPageSeo } from "@prisma/client";
import { db } from "@/lib/db";
import { buildSafe } from "@/lib/utils";
import { GLOBAL_SCOPE, scopeChain } from "@/lib/seo/scope";
import { currentSite } from "@/lib/seo/site";
import { getLocale } from "@/i18n/server";
import { messagesFor } from "@/i18n/messages";
import { DEFAULT_LOCALE } from "@/i18n/routing";
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

/** Сохранённые override-строки одного разреза (для админ-формы). */
export async function getStaticPageRows(scope: string = GLOBAL_SCOPE): Promise<StaticPageSeo[]> {
  return (await load()).filter((r) => r.scope === scope);
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
  const [rows, site, locale] = await Promise.all([load(), currentSite(), getLocale()]);

  // Ищем от точного разреза к общему: у казахстанского домена может быть свой
  // заголовок, а текст оферты — унаследован (мультидомен, D-013).
  const chain = scopeChain(site?.code ?? "BY", locale);
  const inScope = (scopes: readonly string[]) =>
    scopes
      .map((scope) => rows.find((r) => r.path === path && r.scope === scope))
      .filter((r): r is StaticPageSeo => Boolean(r));

  // Тексты на другом языке НЕ наследуются от русских разрезов: ручной русский
  // заголовок на казахской странице хуже казахского значения по умолчанию.
  const textChain =
    locale === DEFAULT_LOCALE ? chain : chain.filter((scope) => scope.endsWith(`-${locale}`));
  const candidates = inScope(textChain);
  const pick = <K extends keyof StaticPageSeo>(key: K) =>
    candidates.find((r) => r[key] !== null && r[key] !== "")?.[key];

  // Запрет индексации, наоборот, наследуется по полной цепочке: если владелец
  // закрыл страницу для всех доменов, языковая версия тоже закрыта.
  const noindexRow = inScope(chain)[0];
  // Пока владелец не заполнил вкладку языка в /admin/seo, казахская страница
  // берёт заголовок и описание из словаря, а не русский фолбэк страницы.
  const localized =
    locale !== DEFAULT_LOCALE && path === "/courses"
      ? {
          title: messagesFor(locale).catalogPage.title,
          description: messagesFor(locale).catalogPage.seoDescription,
        }
      : null;
  return {
    title: (pick("title") as string | undefined) || localized?.title || def.fallbackTitle,
    description:
      (pick("description") as string | undefined) ||
      localized?.description ||
      def.fallbackDescription,
    noindex: noindexRow ? noindexRow.noindex : def.defaultNoindex,
    body: (pick("body") as string | undefined) || null,
  };
}

/** Сбросить кэш после сохранения в админке. */
export function revalidateStaticPageSeo() {
  revalidateTag(STATIC_SEO_TAG);
}
