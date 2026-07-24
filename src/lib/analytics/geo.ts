import "server-only";
import geoip from "geoip-lite";

/**
 * Определение страны посетителя по IP — офлайн, через geoip-lite (база стран внутри
 * пакета, никаких внешних вызовов). CLAUDE.md правило 9: сам IP НИКОГДА не сохраняем и
 * не логируем — берём его только на лету, кладём в Event лишь ISO-код страны (BY/KZ/…).
 *
 * geoip-lite грузит базы в RAM при первом require (~140 МБ). Это учтено в бюджете VPS
 * (правило 10); если память станет узким местом — переносим на mmap-mmdb (Country-only).
 */

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
export function countryFromIp(ip: string | null): string | null {
  if (!ip) return null;
  try {
    const geo = geoip.lookup(ip);
    return geo?.country || null;
  } catch {
    return null;
  }
}
