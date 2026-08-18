"use client";

import { createContext, useContext, useMemo } from "react";
import { DEFAULT_LOCALE, localizePath, type Locale } from "./routing";

/**
 * Язык страницы для клиентских компонентов. Значение приходит из серверного
 * layout (middleware распознаёт префикс `/kk`), поэтому клиент никогда не гадает
 * язык по location — рендер сервера и клиента совпадают.
 */
const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/** Локализатор внутренних ссылок: href("/courses") → "/kk/courses" на казахской версии. */
export function useHref(): (path: string) => string {
  const locale = useLocale();
  return useMemo(() => (path: string) => localizePath(path, locale), [locale]);
}
