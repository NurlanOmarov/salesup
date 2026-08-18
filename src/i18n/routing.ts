/**
 * Маршрутизация языков (казахская версия, docs/MULTI-DOMAIN-PLAN.md).
 *
 * Русский — язык по умолчанию и живёт без префикса: существующие URL всех трёх
 * доменов не меняются, SEO не ломается. Казахский получает префикс `/kk` —
 * отдельный URL обязателен, иначе поисковик не проиндексирует казахскую версию.
 *
 * Казахский доступен ТОЛЬКО на казахстанском домене: на .by и .ru `/kk` — это
 * дубль без аудитории, поэтому middleware уводит такой запрос на русскую версию.
 *
 * Модуль edge-safe (чистые функции): его импортируют и middleware, и auth.config.
 */
export const LOCALES = ["ru", "kk"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "ru";

/** Заголовок, которым middleware передаёт распознанный язык в приложение. */
export const LOCALE_HEADER = "x-locale";

/** Единственный хост с казахской версией. */
export const KK_HOST = "study.activesales.kz";

/**
 * Страницы, у которых казахская версия уже переведена. Список пополняется по мере
 * перевода — это честнее общего флага «готово/не готово»: непереведённый /kk-путь
 * уводится на русскую версию и не попадает в hreflang, поэтому поисковик никогда
 * не видит казахский адрес с русским текстом.
 */
export const KK_PATHS: readonly string[] = ["/", "/courses"];

/**
 * Разделы, где казахский интерфейс работает, но содержимое приходит из БД на
 * русском (карточки курсов: названия, программа, описания). Такие страницы
 * открываем — казахоязычному посетителю удобнее видеть свой интерфейс, — но в
 * hreflang не отдаём: для поисковика это была бы русская страница под казахским
 * адресом. Перевод содержимого курсов — отдельная задача фабрики.
 */
export const KK_MIXED_PREFIXES: readonly string[] = ["/courses/"];

/** Открыта ли казахская версия этого пути (путь — уже без языкового префикса). */
export function hasKazakhVersion(pathname: string): boolean {
  return (
    KK_PATHS.includes(pathname) ||
    KK_MIXED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

/** Отдаём ли казахскую версию поисковику (hreflang + self-canonical). */
export function isKazakhIndexed(pathname: string): boolean {
  return KK_PATHS.includes(pathname);
}

/** Казахская версия существует хотя бы для одной страницы. */
export const KK_READY = KK_PATHS.length > 0;

/** Языки, доступные на хосте: везде русский, на .kz — плюс казахский. */
export function localesForHost(host: string | null | undefined): readonly Locale[] {
  if (!KK_READY) return [DEFAULT_LOCALE];
  const h = host?.split(",")[0]?.trim().toLowerCase().split(":")[0];
  return h === KK_HOST ? LOCALES : [DEFAULT_LOCALE];
}

/**
 * Разбирает путь на язык и «чистый» путь: `/kk/courses` → kk + `/courses`.
 * Для пути без префикса возвращает locale=null — вызывающий сам решает, это
 * язык по умолчанию или отсутствие поддержки.
 */
export function stripLocale(pathname: string): { locale: Locale | null; pathname: string } {
  for (const l of LOCALES) {
    if (l === DEFAULT_LOCALE) continue;
    if (pathname === `/${l}`) return { locale: l, pathname: "/" };
    if (pathname.startsWith(`/${l}/`)) return { locale: l, pathname: pathname.slice(l.length + 1) };
  }
  return { locale: null, pathname };
}

/**
 * Приводит путь к нужному языку: `/courses` + kk → `/kk/courses`, а
 * `/kk/courses` + ru → `/courses`. Принимает путь в любом языке — это и есть
 * переключатель языка для текущей страницы.
 */
export function localizePath(pathname: string, locale: Locale): string {
  const clean = stripLocale(pathname).pathname;
  if (locale === DEFAULT_LOCALE) return clean;
  return clean === "/" ? `/${locale}` : `/${locale}${clean}`;
}
