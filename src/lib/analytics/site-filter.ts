import "server-only";
import { SITE_HOSTS } from "@/lib/seo/site-hosts";
import type { SiteFilter } from "@/lib/analytics/dashboard";

/** Разбор фильтра домена из query (?site=). Общий для страницы дашборда и экспорта. */
export type ResolvedSite = { site: SiteFilter; label: string };

type Getter = (key: string) => string | null | undefined;

export function resolveSite(get: Getter): ResolvedSite {
  const raw = get("site");
  if (raw === "none") return { site: "none", label: "Без домена" };
  const host = SITE_HOSTS.find((s) => s.code === raw);
  if (host) return { site: host.code, label: `${host.country} (${host.code})` };
  return { site: null, label: "Все домены" };
}
