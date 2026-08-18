import "server-only";
import { headers } from "next/headers";
import { env } from "@/env";
import {
  SITE_HOSTS,
  DEFAULT_SITE,
  matchSiteHost,
  alternatesFor,
  type SiteHost,
} from "@/lib/seo/site-hosts";

/**
 * Мультидомен: один сервис отдаёт три ccTLD (docs/MULTI-DOMAIN-PLAN.md).
 * Каждый домен самостоятелен — своя сессия, свой canonical, свой sitemap, свой
 * гео-сигнал; контент, БД и медиа общие. Здесь — то, что зависит от запроса;
 * сам список доменов и чистые хелперы — в site-hosts.ts.
 */
export { SITE_HOSTS, DEFAULT_SITE, matchSiteHost, alternatesFor, type SiteHost };

/** Запись SITE_HOSTS для хоста запроса; неизвестный хост (dev, IP, превью) → null. */
export async function currentSite(): Promise<SiteHost | null> {
  try {
    const h = await headers();
    // edge проксирует реальный $host; X-Forwarded-Host приоритетнее, если есть.
    return matchSiteHost(h.get("x-forwarded-host") ?? h.get("host"));
  } catch {
    // статический контекст (сборка) — заголовков нет
    return null;
  }
}

/**
 * Origin текущего домена для метаданных: `https://<host>` своего домена, а для
 * неизвестного хоста — NEXT_PUBLIC_SITE_URL (dev-адрес или канонический .by).
 * Вызов делает страницу динамической — публичную витрину кэширует микрокэш
 * nginx с ключом по хосту (deploy/proxy_cache_public.conf).
 */
export async function siteOrigin(): Promise<string> {
  const site = await currentSite();
  return site ? `https://${site.host}` : env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
}

/** Наш ли это хост (аналитика: переход между нашими доменами ≠ внешний реферер). */
export function isOwnHost(host: string): boolean {
  if (matchSiteHost(host)) return true;
  try {
    const self = new URL(env.NEXT_PUBLIC_SITE_URL).hostname.toLowerCase();
    return self === host.toLowerCase().split(":")[0];
  } catch {
    return false;
  }
}
