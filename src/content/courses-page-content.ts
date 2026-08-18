import type { Locale } from "@/i18n/routing";
import { coursesPageRu, type CoursesPageContent } from "./courses-page";
import { coursesPageKk } from "./courses-page.kk";
import { pickLocale } from "./localized";

/** Тексты каталога на языке страницы. */
export function coursesPageContent(locale: Locale): CoursesPageContent {
  return pickLocale<CoursesPageContent>(locale, { ru: coursesPageRu, kk: coursesPageKk });
}
