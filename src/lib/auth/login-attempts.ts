import { db } from "@/lib/db";

/**
 * Защита от перебора паролей через таблицу LoginAttempt (CLAUDE.md, правило 3).
 * Порог: ≥5 неудачных попыток за 15 минут по e-mail ИЛИ по IP → блок.
 * Дополнительно стоит nginx rate-limit зона /api/auth.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

export async function isLoginBlocked(
  email: string,
  ip: string,
): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS);
  const [byEmail, byIp] = await Promise.all([
    db.loginAttempt.count({
      where: { email, success: false, createdAt: { gte: since } },
    }),
    db.loginAttempt.count({
      where: { ip, success: false, createdAt: { gte: since } },
    }),
  ]);
  return byEmail >= MAX_FAILURES || byIp >= MAX_FAILURES;
}

export async function recordLoginAttempt(
  email: string,
  ip: string,
  success: boolean,
): Promise<void> {
  await db.loginAttempt.create({ data: { email, ip, success } });
}

/** Извлечь клиентский IP из заголовков (за nginx — X-Forwarded-For). */
export function clientIpFromHeaders(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}
