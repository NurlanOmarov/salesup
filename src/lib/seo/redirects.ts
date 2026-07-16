import "server-only";
import { db } from "@/lib/db";
import { log } from "@/lib/log";

/**
 * Резолвинг 301/308-редиректов на уровне приложения (не в edge-middleware — там нет
 * Prisma). Основной кейс: фабрика переименовала slug курса → старый /courses/<old>
 * ведёт на новый через permanentRedirect в courses/[slug]. hits инкрементируется
 * best-effort (не блокирует ответ, идёт в дайджест).
 */

/** Нормализация пути: ведущий /, без хвостового /, без query/hash. */
export function normalizePath(path: string): string {
  const clean = (path.split("?")[0] ?? "").split("#")[0]?.trim() ?? "";
  const withLead = clean.startsWith("/") ? clean : `/${clean}`;
  return withLead.length > 1 ? withLead.replace(/\/+$/, "") : withLead;
}

/**
 * Найти назначение редиректа для пути. Возвращает `to` или null.
 * Инкремент hits — в фоне (без await на критическом пути), ошибки глотаем.
 */
export async function resolveRedirect(fromPath: string): Promise<string | null> {
  const from = normalizePath(fromPath);
  const row = await db.redirect.findUnique({ where: { from } });
  if (!row) return null;

  db.redirect
    .update({ where: { id: row.id }, data: { hits: { increment: 1 } } })
    .catch((e) => log.warn({ err: e, from }, "redirect: не удалось инкрементировать hits"));

  return row.to;
}
