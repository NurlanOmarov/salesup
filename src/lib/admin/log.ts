import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Журнал действий владельца (S5.1, CLAUDE.md): каждая выдача/отзыв доступа,
 * создание ученика, сброс пароля и т.п. фиксируется в AdminLog. Источник истины
 * для аудита — не для UI-уведомлений.
 */
export type AdminAction =
  | "student.create"
  | "enrollment.grant"
  | "enrollment.revoke"
  | "enrollment.extend"
  | "password.reset"
  | "student.block"
  | "student.unblock"
  | "student.device_limit"
  | "lead.update"
  | "course.update"
  | "course.cover"
  | "seo.settings.update"
  | "seo.redirect.create"
  | "seo.redirect.delete"
  | "certificate.issue";

export function writeAdminLog(params: {
  actorId: string;
  action: AdminAction;
  targetUserId?: string;
  meta?: Prisma.InputJsonValue;
  tx?: Prisma.TransactionClient;
}): Promise<unknown> {
  const client = params.tx ?? db;
  return client.adminLog.create({
    data: {
      actorId: params.actorId,
      action: params.action,
      targetUserId: params.targetUserId ?? null,
      meta: params.meta,
    },
  });
}
