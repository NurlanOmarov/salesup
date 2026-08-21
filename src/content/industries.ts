import type { Locale } from "@/i18n/routing";
import { DEFAULT_LOCALE, type ExtraLocale } from "@/i18n/routing";

/**
 * Названия отраслей курсов на языках витрины.
 *
 * Отрасль (`Course.industry`) — свободная строка, её задаёт владелец в админке,
 * поэтому переводим по словарю с фолбэком: незнакомое значение показываем как
 * есть, а не прячем и не ломаем фильтр каталога.
 */
const INDUSTRIES: Record<string, Record<ExtraLocale, string>> = {
  Туризм: { kk: "Туризм", uz: "Turizm" },
  "Мебель и кухни": { kk: "Жиһаз және ас үй", uz: "Mebel va oshxonalar" },
  "Обувь и одежда": { kk: "Аяқ киім және киім", uz: "Poyabzal va kiyim" },
  Недвижимость: { kk: "Жылжымайтын мүлік", uz: "Ko'chmas mulk" },
  Медпредставители: { kk: "Медициналық өкілдер", uz: "Tibbiyot vakillari" },
  "B2B-переговоры": { kk: "B2B келіссөздер", uz: "B2B muzokaralar" },
  "Тайм-менеджмент": { kk: "Тайм-менеджмент", uz: "Taym-menejment" },
  "Техники продаж": { kk: "Сату техникалары", uz: "Sotuv texnikalari" },
  FMCG: { kk: "FMCG", uz: "FMCG" },
  Розница: { kk: "Бөлшек сауда", uz: "Chakana savdo" },
};

/** Отрасль на языке страницы; неизвестное значение остаётся как есть. */
export function localizedIndustry(industry: string | null, locale: Locale): string | null {
  if (!industry || locale === DEFAULT_LOCALE) return industry;
  return INDUSTRIES[industry]?.[locale as ExtraLocale] ?? industry;
}
