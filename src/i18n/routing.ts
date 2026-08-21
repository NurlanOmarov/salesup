/**
 * Маршрутизация языков (docs/MULTI-DOMAIN-PLAN.md).
 *
 * Русский — язык по умолчанию и живёт без префикса: существующие URL всех
 * доменов не меняются, SEO не ломается. Второй язык домена получает префикс
 * (`/kk`, `/uz`) — отдельный URL обязателен, иначе поисковик не проиндексирует
 * локальную версию.
 *
 * Язык привязан к домену: казахский есть только на казахстанском, узбекский —
 * только на узбекском. На чужом домене такой префикс — дубль без аудитории,
 * поэтому middleware уводит запрос на русскую версию.
 *
 * Модуль edge-safe (чистые функции): его импортируют и middleware, и auth.config.
 */
export const LOCALES = ["ru", "kk", "uz"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "ru";

/** Языки помимо русского — те, что живут под префиксом. */
export type ExtraLocale = Exclude<Locale, "ru">;

/** Заголовок, которым middleware передаёт распознанный язык в приложение. */
export const LOCALE_HEADER = "x-locale";

/** Второй язык домена. Один хост — один дополнительный язык. */
export const HOST_LOCALE: Readonly<Record<string, ExtraLocale>> = {
  "study.activesales.kz": "kk",
  "study.activesales.uz": "uz",
};

/** Домен, на котором живёт язык (для hreflang и переключателя). */
export function hostForLocale(locale: ExtraLocale): string | null {
  return Object.entries(HOST_LOCALE).find(([, l]) => l === locale)?.[0] ?? null;
}

/**
 * Страницы, переведённые на язык. Список пополняется по мере перевода — это
 * честнее общего флага «готово/не готово»: непереведённый путь под префиксом
 * уводится на русскую версию и не попадает в hreflang, поэтому поисковик
 * никогда не видит локальный адрес с русским текстом.
 */
export const TRANSLATED_PATHS: Readonly<Record<ExtraLocale, readonly string[]>> = {
  kk: ["/", "/courses", "/business"],
  uz: ["/", "/courses", "/business"],
};

/**
 * Разделы, где интерфейс переведён, а содержимое приходит из БД на русском
 * (карточки курсов: названия, программа, описания). Такие страницы открываем —
 * посетителю удобнее видеть свой интерфейс, — но в hreflang не отдаём: для
 * поисковика это была бы русская страница под локальным адресом. Перевод
 * содержимого курсов — отдельная задача фабрики.
 */
export const MIXED_PREFIXES: readonly string[] = ["/courses/"];

/** Открыта ли версия пути на этом языке (путь — уже без языкового префикса). */
export function hasLocaleVersion(pathname: string, locale: ExtraLocale): boolean {
  return (
    TRANSLATED_PATHS[locale].includes(pathname) ||
    MIXED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

/** Отдаём ли версию поисковику (hreflang + self-canonical). */
export function isLocaleIndexed(pathname: string, locale: ExtraLocale): boolean {
  return TRANSLATED_PATHS[locale].includes(pathname);
}

/** Языки, доступные на хосте: везде русский, плюс язык домена, если он есть. */
export function localesForHost(host: string | null | undefined): readonly Locale[] {
  const h = host?.split(",")[0]?.trim().toLowerCase().split(":")[0] ?? "";
  const extra = HOST_LOCALE[h];
  return extra && TRANSLATED_PATHS[extra].length > 0
    ? [DEFAULT_LOCALE, extra]
    : [DEFAULT_LOCALE];
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
