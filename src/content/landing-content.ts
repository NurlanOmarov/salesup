import type { Locale } from "@/i18n/routing";
import { landingRu, type LandingContent } from "./landing";
import { landingKk } from "./landing.kk";
import { landingUz } from "./landing.uz";
import { pickLocale } from "./localized";

/** Контент лендинга на языке страницы (русский — язык по умолчанию). */
export function landingContent(locale: Locale): LandingContent {
  return pickLocale<LandingContent>(locale, { ru: landingRu, kk: landingKk, uz: landingUz });
}
