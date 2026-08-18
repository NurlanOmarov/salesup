import "server-only";
import { headers } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_HEADER, LOCALES, localizePath, type Locale } from "./routing";

/**
 * Язык текущего запроса: его проставляет middleware по префиксу `/kk`
 * (src/middleware.ts). Вне запроса и на неизвестном значении — русский.
 */
export async function getLocale(): Promise<Locale> {
  try {
    const value = (await headers()).get(LOCALE_HEADER);
    return LOCALES.includes(value as Locale) ? (value as Locale) : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

/**
 * Локализатор внутренних ссылок для серверных компонентов: `href("/courses")`
 * вернёт `/kk/courses` на казахской версии и `/courses` на русской.
 */
export async function getHref(): Promise<(path: string) => string> {
  const locale = await getLocale();
  return (path: string) => localizePath(path, locale);
}
