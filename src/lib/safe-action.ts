import { z } from "zod";
import type { Session } from "next-auth";
import { auth } from "@/auth";

/**
 * Обёртка Server Actions (CLAUDE.md): валидация Zod + (опц.) проверка auth + единый
 * формат результата. Логика доступа к контенту — в lib/access.ts, не здесь.
 */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

interface Options<S extends z.ZodTypeAny> {
  schema: S;
  /**
   * Требовать аутентификацию (и опционально роль).
   * "orgAdmin" — ответственный представитель организации; сам факт членства
   * и принадлежность сущностей проверяет lib/org/guards (БД, каждый запрос),
   * здесь только грубый отсев по токену.
   */
  auth?: "user" | "owner" | "orgAdmin";
}

export function safeAction<S extends z.ZodTypeAny, T>(
  opts: Options<S>,
  handler: (input: z.infer<S>, ctx: { session: Session | null }) => Promise<T>,
) {
  return async (raw: unknown): Promise<ActionResult<T>> => {
    const parsed = opts.schema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Проверьте правильность заполнения полей",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    let session: Session | null = null;
    if (opts.auth) {
      session = await auth();
      if (!session?.user) return { ok: false, error: "Требуется вход" };
      if (opts.auth === "owner" && session.user.role !== "OWNER") {
        return { ok: false, error: "Недостаточно прав" };
      }
      if (
        opts.auth === "orgAdmin" &&
        session.user.role !== "OWNER" &&
        session.user.orgRole !== "ORG_ADMIN"
      ) {
        return { ok: false, error: "Недостаточно прав" };
      }
    }

    try {
      const data = await handler(parsed.data, { session });
      return { ok: true, data };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Внутренняя ошибка";
      return { ok: false, error: msg };
    }
  };
}
