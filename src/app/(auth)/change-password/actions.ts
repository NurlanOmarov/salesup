"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { auth, updateSession } from "@/auth";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Введите текущий пароль"),
    newPassword: z
      .string()
      .min(8, "Минимум 8 символов")
      .max(128, "Слишком длинный пароль"),
    confirmPassword: z.string().min(1, "Повторите пароль"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Пароли не совпадают",
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    path: ["newPassword"],
    message: "Новый пароль должен отличаться от текущего",
  });

export interface ChangePasswordState {
  error?: string;
}

export async function changePasswordAction(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const parsed = schema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Проверьте поля" };
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user?.passwordHash) redirect("/login");

  const ok = await verifyPassword(user.passwordHash, parsed.data.currentPassword);
  if (!ok) return { error: "Текущий пароль неверен" };

  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(parsed.data.newPassword),
      mustChangePassword: false,
    },
  });

  // обновляем JWT, иначе middleware продолжит редиректить на /change-password
  await updateSession({ mustChangePassword: false } as never);

  redirect("/app");
}
