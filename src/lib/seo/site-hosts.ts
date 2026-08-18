import type { Metadata } from "next";

/**
 * Домены платформы (мультидомен, docs/MULTI-DOMAIN-PLAN.md). Отдельный модуль без
 * server-only: список нужен и серверным метаданным, и клиентскому переключателю
 * стран в футере. Добавление страны = одна строка здесь (+ DNS + «Add Domain»).
 */
export const SITE_HOSTS = [
  { host: "study.activesales.by", hreflang: "ru-BY", country: "Беларусь", code: "BY" },
  { host: "study.activesales.kz", hreflang: "ru-KZ", country: "Казахстан", code: "KZ" },
  { host: "study.sales-active.ru", hreflang: "ru-RU", country: "Россия", code: "RU" },
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
 * hreflang на все домены. Так каждый ccTLD ранжируется в своей стране, а
 * одинаковый русский контент не считается дублем.
 */
export function alternatesFor(path: string): Metadata["alternates"] {
  const p = path === "/" ? "" : path;
  const languages: Record<string, string> = {};
  for (const s of SITE_HOSTS) languages[s.hreflang] = `https://${s.host}${p}`;
  languages["x-default"] = `https://${DEFAULT_SITE.host}${p}`;
  return { canonical: path, languages };
}
