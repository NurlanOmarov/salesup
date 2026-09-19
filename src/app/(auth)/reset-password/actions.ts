"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { findValidResetToken } from "@/lib/auth/password-reset";
import { enqueue } from "@/lib/jobs/enqueue";
import { writeAdminLog } from "@/lib/admin/log";

const schema = z
  .object({
    token: z.string().min(1),
    newPassword: z.string().min(8, "Минимум 8 символов").max(128, "Слишком длинный пароль"),
    confirmPassword: z.string().min(1, "Повторите пароль"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Пароли не совпадают",
  });

export interface ResetState {
  error?: string;
}

/** Задать новый пароль по ссылке из письма. Ссылка одноразовая. */
export async function resetPasswordAction(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const parsed = schema.safeParse({
    token: formData.get("token"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Проверьте поля" };
  }

  const found = await findValidResetToken(parsed.data.token);
  if (!found) {
    return { error: "Ссылка недействительна или устарела. Запросите новую на странице входа." };
  }

  const user = await db.user.findFirst({
    where: { email: { equals: found.email, mode: "insensitive" }, deletedAt: null, role: "STUDENT" },
    select: { id: true, email: true },
  });
  if (!user?.email) {
    return { error: "Ссылка недействительна или устарела. Запросите новую на странице входа." };
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  // Пароль, гашение ссылки и снятие блокировки входа — вместе: остаться с
  // рабочей ссылкой после смены пароля нельзя.
  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      // Человек выбрал пароль сам — принудительная смена не нужна.
      data: { passwordHash, mustChangePassword: false },
    }),
    db.verificationToken.deleteMany({ where: { identifier: found.identifier } }),
    db.loginAttempt.deleteMany({ where: { email: user.email.toLowerCase(), success: false } }),
  ]);

  await writeAdminLog({
    actorId: user.id,
    action: "password.reset",
    targetUserId: user.id,
    meta: { self: true },
  });
  await enqueue("auth.password-changed", { email: user.email });

  redirect("/login?reset=1");
}
