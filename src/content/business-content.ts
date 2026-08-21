import type { Locale } from "@/i18n/routing";
import { businessRu, type BusinessContent } from "./business";
import { businessKk } from "./business.kk";
import { businessUz } from "./business.uz";
import { pickLocale } from "./localized";

/** Тексты корпоративной страницы на языке страницы. */
export function businessContent(locale: Locale): BusinessContent {
  return pickLocale<BusinessContent>(locale, {
    ru: businessRu,
    kk: businessKk,
    uz: businessUz,
  });
}
