import "server-only";
import { join } from "node:path";

/**
 * Определение страны посетителя по IP — офлайн, через geoip-lite (база стран внутри
 * пакета, никаких внешних вызовов). CLAUDE.md правило 9: сам IP НИКОГДА не сохраняем и
 * не логируем — берём его только на лету, кладём в Event лишь ISO-код страны (BY/KZ/…).
 *
 * geoip-lite бандлится webpack'ом (не external), а его .dat-базы копируются в
 * standalone-образ через outputFileTracingIncludes (next.config). Путь к базам задаём
 * ДО загрузки модуля через global.geodatadir, т.к. в бандле __dirname не указывает на
 * папку пакета. Загрузка ленивая — базы (~140 МБ RAM) поднимаются при первом запросе.
 */

type Lookup = (ip: string) => { country?: string } | null;
let lookupFn: Lookup | null = null;

async function getLookup(): Promise<Lookup> {
  if (!lookupFn) {
    (globalThis as { geodatadir?: string }).geodatadir =
      process.env.GEODATADIR || join(process.cwd(), "node_modules/geoip-lite/data");
    const mod = await import("geoip-lite");
    const geoip = (mod as unknown as { default?: { lookup: Lookup }; lookup?: Lookup }).default ?? mod;
    lookupFn = (geoip as { lookup: Lookup }).lookup;
  }
  return lookupFn;
}

/** IP клиента из заголовков прокси. nginx проставляет X-Real-IP / X-Forwarded-For. */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    // Формат: "client, proxy1, proxy2" — берём самый левый (реальный клиент).
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip");
}

/** ISO-код страны по IP или null (приватный/локальный/неопределённый IP). */
export async function countryFromIp(ip: string | null): Promise<string | null> {
  if (!ip) return null;
  try {
    const lookup = await getLookup();
    const geo = lookup(ip);
    return geo?.country || null;
  } catch {
    return null;
  }
}
