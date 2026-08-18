import type { Locale } from "@/i18n/routing";

/**
 * Локализованный контент витрины (казахская версия, docs/MULTI-DOMAIN-PLAN.md).
 *
 * Тексты лендинга и каталога живут в src/content/*.ts. Русский — источник
 * структуры: казахский модуль обязан повторять её ключ в ключ, иначе страница
 * соберётся с дырами. Это гарантирует тип Localized<T> — он «расширяет»
 * литеральные типы русского контента до string, оставляя форму неизменной.
 */
export type Localized<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends string
    ? string
    : T extends number
      ? number
      : T extends boolean
        ? boolean
        : T extends readonly (infer U)[]
          ? readonly Localized<U>[]
          : T extends object
            ? {
                // icon — служебный ключ (выбор компонента-иконки), а не текст:
                // его литеральный тип сохраняем, иначе перевод сможет подставить
                // несуществующую иконку и страница упадёт на рендере.
                readonly [K in keyof T]: K extends "icon" ? T[K] : Localized<T[K]>;
              }
            : T;

/** Выбор словаря по языку запроса; неизвестный язык → русский. */
export function pickLocale<T>(locale: Locale, dictionaries: Record<Locale, T>): T {
  return dictionaries[locale] ?? dictionaries.ru;
}
