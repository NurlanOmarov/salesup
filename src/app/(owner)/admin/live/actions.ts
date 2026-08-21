"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { safeAction } from "@/lib/safe-action";
import { writeAdminLog } from "@/lib/admin/log";
import { zonedInputToUtc } from "@/lib/live/format";
import * as live from "@/lib/live/service";

/**
 * Консоль владельца → живые сессии с тренером (docs/LIVE-SESSIONS-PLAN.md).
 *
 * Встречи ведёт один человек, поэтому календарь здесь общий: занятый слот —
 * жёсткая ошибка, а не предупреждение. Дважды продать одно и то же время
 * двум компаниям означает сорвать обе встречи.
 */

const kinds = z.enum(["INTRO", "FINAL", "EXTRA"]);

const planSchema = z.object({
  orgId: z.string().min(1, "Выберите организацию"),
  kind: kinds,
  title: z.string().trim().min(3, "Укажите название встречи").max(160),
  // Время приходит как «2026-09-10T14:00» в зоне компании — в UTC переводим
  // здесь, чтобы в БД не попало локальное время сервера.
  localAt: z.string().trim().min(10, "Укажите дату и время"),
  timezone: z.string().trim().min(3),
  durationMin: z.coerce.number().int().min(15).max(480),
  courseId: z.string().trim().optional().or(z.literal("")),
  note: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const planSessionAction = safeAction(
  { schema: planSchema, auth: "owner" },
  async (input, { session }) => {
    const scheduledAt = zonedInputToUtc(input.localAt, input.timezone);

    const clash = await live.conflictsWith(scheduledAt, input.durationMin);
    if (clash) {
      throw new Error(
        `В это время уже назначена встреча «${clash.title}». Выберите другое время.`,
      );
    }

    const created = await live.planSession({
      orgId: input.orgId,
      kind: input.kind,
      title: input.title,
      scheduledAt,
      timezone: input.timezone,
      durationMin: input.durationMin,
      courseId: input.courseId || null,
      note: input.note || null,
    });

    await writeAdminLog({
      actorId: session!.user.id,
      action: "live.session.plan",
      meta: { sessionId: created.id, orgId: input.orgId, kind: input.kind },
    });

    revalidatePath("/admin/live");
    revalidatePath(`/org/${input.orgId}`);
    // Владельцу важно сразу понять, доехала ли встреча до SABAK: без ссылки её
    // некому раздать, и это надо чинить сейчас, а не в день встречи.
    return { id: created.id, remote: !!created.sabakLessonId };
  },
);

export const rescheduleSessionAction = safeAction(
  {
    schema: z.object({
      id: z.string().min(1),
      localAt: z.string().trim().min(10),
      timezone: z.string().trim().min(3),
      durationMin: z.coerce.number().int().min(15).max(480),
    }),
    auth: "owner",
  },
  async (input, { session }) => {
    const scheduledAt = zonedInputToUtc(input.localAt, input.timezone);
    const clash = await live.conflictsWith(scheduledAt, input.durationMin, input.id);
    if (clash) {
      throw new Error(`В это время уже назначена встреча «${clash.title}».`);
    }

    const updated = await live.reschedule(input.id, scheduledAt, input.durationMin);
    await writeAdminLog({
      actorId: session!.user.id,
      action: "live.session.reschedule",
      meta: { sessionId: input.id },
    });
    revalidatePath("/admin/live");
    revalidatePath(`/org/${updated.orgId}`);
    return { ok: true };
  },
);

export const cancelSessionAction = safeAction(
  { schema: z.object({ id: z.string().min(1) }), auth: "owner" },
  async (input, { session }) => {
    const cancelled = await live.cancelSession(input.id);
    await writeAdminLog({
      actorId: session!.user.id,
      action: "live.session.cancel",
      meta: { sessionId: input.id },
    });
    revalidatePath("/admin/live");
    revalidatePath(`/org/${cancelled.orgId}`);
    return { ok: true };
  },
);

/** Повторная попытка создать встречу в SABAK, когда тот был недоступен. */
export const retryRemoteAction = safeAction(
  { schema: z.object({ id: z.string().min(1) }), auth: "owner" },
  async (input) => {
    const ok = await live.ensureRemote(input.id);
    revalidatePath("/admin/live");
    if (!ok) throw new Error("SABAK по-прежнему недоступен — попробуйте позже");
    return { ok };
  },
);

/** Подтянуть итоги прошедшей встречи: посещаемость и готовность записи. */
export const syncResultAction = safeAction(
  { schema: z.object({ id: z.string().min(1) }), auth: "owner" },
  async (input) => {
    await live.syncResult(input.id);
    revalidatePath("/admin/live");
    return { ok: true };
  },
);
