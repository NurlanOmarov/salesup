"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { safeAction } from "@/lib/safe-action";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { generateTempPassword } from "@/lib/auth/temp-password";
import { writeAdminLog } from "@/lib/admin/log";
import { computeExpiry, ACCESS_DURATIONS } from "@/lib/admin/enrollment";

/**
 * Управление учениками и доступами (S5.1). Все действия — только OWNER (safeAction),
 * каждое пишется в AdminLog. Доступ к контенту проверяется в lib/access; здесь — выдача.
 */

const emailSchema = z.string().email("Введите корректный e-mail").toLowerCase();

/** Период доступа, выбранный админом. Опционален — без него берётся тариф курса (accessDuration). */
const accessDurationSchema = z.enum(ACCESS_DURATIONS).optional();

/** Создать ученика и сразу выдать доступы к выбранным курсам. Возвращает временный пароль (показать один раз). */
export const createStudentAction = safeAction(
  {
    schema: z.object({
      email: emailSchema,
      name: z.string().trim().min(1, "Укажите имя для сертификата"),
      phone: z.string().trim().optional(),
      industry: z.string().trim().optional(),
      courseIds: z.array(z.string()).default([]),
      accessDuration: accessDurationSchema,
    }),
    auth: "owner",
  },
  async ({ email, name, phone, industry, courseIds, accessDuration }, { session }) => {
    const actorId = session!.user.id;

    const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) throw new Error("Пользователь с таким e-mail уже существует");

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    const courses = courseIds.length
      ? await db.course.findMany({
          where: { id: { in: courseIds } },
          select: { id: true, accessDuration: true },
        })
      : [];

    const now = new Date();
    const student = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name,
          phone: phone || null,
          industry: industry || null,
          role: "STUDENT",
          passwordHash,
          mustChangePassword: true,
        },
      });

      for (const c of courses) {
        await tx.enrollment.create({
          data: {
            userId: user.id,
            courseId: c.id,
            source: "MANUAL",
            startsAt: now,
            expiresAt: computeExpiry(accessDuration ?? c.accessDuration, now),
          },
        });
      }

      await writeAdminLog({
        actorId,
        action: "student.create",
        targetUserId: user.id,
        meta: { email, courseIds: courses.map((c) => c.id), accessDuration: accessDuration ?? null },
        tx,
      });

      return user;
    });

    revalidatePath("/admin/students");
    return { studentId: student.id, email, tempPassword };
  },
);

/** Выдать доступ к курсу существующему ученику. */
export const grantEnrollmentAction = safeAction(
  {
    schema: z.object({
      userId: z.string().min(1),
      courseId: z.string().min(1),
      accessDuration: accessDurationSchema,
    }),
    auth: "owner",
  },
  async ({ userId, courseId, accessDuration }, { session }) => {
    const course = await db.course.findUnique({
      where: { id: courseId },
      select: { accessDuration: true },
    });
    if (!course) throw new Error("Курс не найден");

    const duration = accessDuration ?? course.accessDuration;
    const now = new Date();
    const expiresAt = computeExpiry(duration, now);
    await db.enrollment.upsert({
      where: { userId_courseId: { userId, courseId } },
      create: {
        userId,
        courseId,
        source: "MANUAL",
        startsAt: now,
        expiresAt,
      },
      // повторная выдача снимает прежний отзыв и продлевает от текущего момента
      update: {
        revokedAt: null,
        startsAt: now,
        expiresAt,
      },
    });

    await writeAdminLog({
      actorId: session!.user.id,
      action: "enrollment.grant",
      targetUserId: userId,
      meta: { courseId, accessDuration: duration },
    });

    revalidatePath(`/admin/students/${userId}`);
    return { ok: true };
  },
);

/** Отозвать доступ — закрывает видео немедленно (access.ts видит revokedAt). */
export const revokeEnrollmentAction = safeAction(
  {
    schema: z.object({ userId: z.string().min(1), courseId: z.string().min(1) }),
    auth: "owner",
  },
  async ({ userId, courseId }, { session }) => {
    await db.enrollment.update({
      where: { userId_courseId: { userId, courseId } },
      data: { revokedAt: new Date() },
    });

    await writeAdminLog({
      actorId: session!.user.id,
      action: "enrollment.revoke",
      targetUserId: userId,
      meta: { courseId },
    });

    revalidatePath(`/admin/students/${userId}`);
    return { ok: true };
  },
);

/** Сбросить пароль ученика: новый временный + форс-смена. Возвращает пароль (показать один раз). */
export const resetPasswordAction = safeAction(
  {
    schema: z.object({ userId: z.string().min(1) }),
    auth: "owner",
  },
  async ({ userId }, { session }) => {
    const tempPassword = generateTempPassword();
    await db.user.update({
      where: { id: userId },
      data: {
        passwordHash: await hashPassword(tempPassword),
        mustChangePassword: true,
      },
    });

    await writeAdminLog({
      actorId: session!.user.id,
      action: "password.reset",
      targetUserId: userId,
    });

    return { tempPassword };
  },
);

/** Заблокировать/разблокировать вход ученика (deletedAt; authorize не пускает заблокированных). */
export const toggleBlockAction = safeAction(
  {
    schema: z.object({ userId: z.string().min(1), blocked: z.boolean() }),
    auth: "owner",
  },
  async ({ userId, blocked }, { session }) => {
    await db.user.update({
      where: { id: userId },
      data: { deletedAt: blocked ? new Date() : null },
    });

    await writeAdminLog({
      actorId: session!.user.id,
      action: blocked ? "student.block" : "student.unblock",
      targetUserId: userId,
    });

    revalidatePath(`/admin/students/${userId}`);
    return { blocked };
  },
);

/**
 * Установить лимит одновременных устройств ученика.
 *   mode=default → стандартный лимит (null), unlimited → безлимит (0), custom → N≥1.
 * Новое устройство сверх лимита не пускается на вход (см. lib/antishare/devices).
 */
export const setDeviceLimitAction = safeAction(
  {
    schema: z.object({
      userId: z.string().min(1),
      mode: z.enum(["default", "unlimited", "custom"]),
      limit: z.coerce.number().int().min(1).max(50).optional(),
    }),
    auth: "owner",
  },
  async ({ userId, mode, limit }, { session }) => {
    const value = mode === "default" ? null : mode === "unlimited" ? 0 : (limit ?? 2);
    await db.user.update({ where: { id: userId }, data: { deviceLimit: value } });

    await writeAdminLog({
      actorId: session!.user.id,
      action: "student.device_limit",
      targetUserId: userId,
      meta: { deviceLimit: value },
    });

    revalidatePath(`/admin/students/${userId}`);
    return { deviceLimit: value };
  },
);
