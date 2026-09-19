import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";

/**
 * Самообслуживание: сброс пароля по ссылке из письма. Доступно тем, у кого есть
 * e-mail, — розничным ученикам и ответственным представителям организаций.
 * У работников организаций e-mail нет by design (ПДн не собираем), им пароль
 * сбрасывает ответственный в кабинете компании.
 *
 * Токен — 256 случайных бит. В базе лежит только его SHA-256: тот, кто прочитает
 * таблицу, ссылку из неё не соберёт. Используем существующую таблицу
 * VerificationToken (Auth.js), identifier = `pwreset:<e-mail>`. Один активный
 * токен на адрес: новый запрос отзывает прежнюю ссылку.
 */

export const RESET_TTL_MINUTES = 60;
/** Не больше стольких писем на один адрес в час — иначе форма превращается в спам-пушку. */
export const RESET_MAX_REQUESTS_PER_HOUR = 3;
export const SEND_RESET_JOB = "auth.send-reset";

const PREFIX = "pwreset:";

export function resetIdentifier(email: string): string {
  return `${PREFIX}${email.trim().toLowerCase()}`;
}

export function generateResetToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashResetToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Выпустить токен и вернуть его открытое значение (в базе останется хеш). */
export async function issueResetToken(email: string, now = new Date()): Promise<string> {
  const raw = generateResetToken();
  const identifier = resetIdentifier(email);
  await db.$transaction([
    db.verificationToken.deleteMany({ where: { identifier } }),
    db.verificationToken.create({
      data: {
        identifier,
        token: hashResetToken(raw),
        expires: new Date(now.getTime() + RESET_TTL_MINUTES * 60_000),
      },
    }),
  ]);
  return raw;
}

/** Ссылка ещё действует? Возвращает e-mail владельца токена или null. */
export async function findValidResetToken(
  raw: string,
  now = new Date(),
): Promise<{ email: string; identifier: string } | null> {
  if (!raw || raw.length > 200) return null;
  const record = await db.verificationToken.findUnique({ where: { token: hashResetToken(raw) } });
  if (!record || !record.identifier.startsWith(PREFIX) || record.expires <= now) return null;
  return { email: record.identifier.slice(PREFIX.length), identifier: record.identifier };
}

/** Сколько писем по этому адресу поставлено в очередь за последний час. */
export async function recentResetRequests(email: string, now = new Date()): Promise<number> {
  return db.job.count({
    where: {
      type: SEND_RESET_JOB,
      createdAt: { gte: new Date(now.getTime() - 3_600_000) },
      payload: { path: ["email"], equals: email.trim().toLowerCase() },
    },
  });
}
