import type { Metadata } from "next";
import {
  DEFAULT_LOCALE,
  KK_HOST,
  isKazakhIndexed,
  localizePath,
  type Locale,
} from "@/i18n/routing";

/**
 * Домены платформы (мультидомен, docs/MULTI-DOMAIN-PLAN.md). Отдельный модуль без
 * server-only: список нужен и серверным метаданным, и клиентскому переключателю
 * стран в футере. Добавление страны = одна строка здесь (+ DNS + «Add Domain»).
 */
export const SITE_HOSTS = [
  {
    host: "study.activesales.by",
    hreflang: "ru-BY",
    country: "Беларусь",
    code: "BY",
    /** Гео-строка витрины на языках сайта: «курсы … · <geo>» в первом экране. */
    geo: { ru: "Минск · вся Беларусь", kk: "Минск · бүкіл Беларусь" },
    /** Валюта, которую посетитель видит крупно (остальные — справочно). */
    currency: "byn",
  },
  {
    host: "study.activesales.kz",
    hreflang: "ru-KZ",
    country: "Казахстан",
    code: "KZ",
    geo: { ru: "Астана · Алматы · весь Казахстан", kk: "Астана · Алматы · бүкіл Қазақстан" },
    currency: "kzt",
  },
  {
    host: "study.sales-active.ru",
    hreflang: "ru-RU",
    country: "Россия",
    code: "RU",
    geo: { ru: "Москва · вся Россия", kk: "Мәскеу · бүкіл Ресей" },
    currency: "rub",
  },
] as const;

export type SiteHost = (typeof SITE_HOSTS)[number];

/** Канонический домен: fallback для неизвестных хостов, x-default в hreflang. */
export const DEFAULT_SITE = SITE_HOSTS[0];

/** Наш домен по значению заголовка Host (с портом или без) — иначе null. */
export function matchSiteHost(host: string | null | undefined): SiteHost | null {
  if (!host) return null;
  const h = host.split(",")[0]!.trim().toLowerCase().split(":")[0]!;
  return SITE_HOSTS.find((s) => s.host === h) ?? null;
}

/**
 * alternates для индексируемой публичной страницы: self-canonical (относительный
 * путь разворачивает host-aware metadataBase из src/app/layout.tsx) + взаимный
 * hreflang на все домены и языки. Так каждый ccTLD ранжируется в своей стране,
 * одинаковый русский контент не считается дублем, а казахская версия
 * казахстанского домена получает собственный hreflang kk-KZ.
 *
 * locale — язык текущей страницы: от него зависит canonical (казахская версия
 * канонизируется на /kk-адрес, а не на русский).
 */
export function alternatesFor(
  path: string,
  locale: Locale = DEFAULT_LOCALE,
): Metadata["alternates"] {
  const suffix = (p: string) => (p === "/" ? "" : p);
  const languages: Record<string, string> = {};
  for (const s of SITE_HOSTS) languages[s.hreflang] = `https://${s.host}${suffix(path)}`;
  // Казахская версия — только на казахстанском домене и только у переведённых
  // страниц, иначе hreflang вёл бы на русский текст.
  if (isKazakhIndexed(path)) {
    languages["kk-KZ"] = `https://${KK_HOST}${suffix(localizePath(path, "kk"))}`;
  }
  languages["x-default"] = `https://${DEFAULT_SITE.host}${suffix(path)}`;
  // Казахская страница со смешанным содержимым канонизируется на русскую —
  // иначе в индекс попал бы дубль с русским текстом под казахским адресом.
  const canonical =
    locale === DEFAULT_LOCALE || isKazakhIndexed(path) ? localizePath(path, locale) : path;
  return { canonical, languages };
}
