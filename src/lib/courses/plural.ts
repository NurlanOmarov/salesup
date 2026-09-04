import type { Locale } from "@/i18n/routing";

/**
 * Счётные подписи витрины («3 модуля · 5 уроков»).
 *
 * Русский требует трёх форм, поэтому подпись нельзя собирать конкатенацией
 * числа и слова из словаря. В казахском и узбекском числительное форму слова
 * не меняет — там достаточно одной.
 */
/** Русское склонение по числу: 1 урок / 2 урока / 5 уроков. */
export function pluralRu(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/** «1 урок» / «2 урока» / «5 уроков». */
export function lessonsLabel(n: number, locale: Locale = "ru"): string {
  if (locale === "kk") return `${n} сабақ`;
  if (locale === "uz") return `${n} dars`;
  return `${n} ${pluralRu(n, "урок", "урока", "уроков")}`;
}

/** «1 модуль» / «2 модуля» / «5 модулей». */
export function modulesLabel(n: number, locale: Locale = "ru"): string {
  if (locale === "kk") return `${n} модуль`;
  if (locale === "uz") return `${n} modul`;
  return `${n} ${pluralRu(n, "модуль", "модуля", "модулей")}`;
}
