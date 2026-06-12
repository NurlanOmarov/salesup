"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { safeAction } from "@/lib/safe-action";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

/**
 * Профиль и безопасность ученика (S4.3). Имя «как в сертификате» — критично:
 * именно оно печатается в PDF-сертификате, поэтому ученик может его исправить.
 */

const SUBTITLE_LANGS = ["RU", "KK", "EN", "UZ"] as const;

export const updateProfileAction = safeAction(
  {
    schema: z.object({
      name: z.string().trim().min(1, "Укажите имя для сертификата").max(120),
      industry: z.string().trim().max(120).optional(),
      position: z.string().trim().max(120).optional(),
      // "" → сбросить язык субтитров по умолчанию (выкл)
      subtitleLang: z.enum(["", ...SUBTITLE_LANGS]).optional(),
    }),
    auth: "user",
  },
  async ({ name, industry, position, subtitleLang }, { session }) => {
    await db.user.update({
      where: { id: session!.user.id },
      data: {
        name,
        industry: industry || null,
        position: position || null,
        subtitleLang: subtitleLang ? subtitleLang : null,
      },
    });
    revalidatePath("/app/settings");
    return { ok: true };
  },
);

export const changeOwnPasswordAction = safeAction(
  {
    // .refine с синхронными стрелками нельзя в "use server"-файле — кросс-полевые
    // проверки делаем в обработчике ниже.
    schema: z.object({
      currentPassword: z.string().min(1, "Введите текущий пароль"),
      newPassword: z.string().min(8, "Минимум 8 символов").max(128),
      confirmPassword: z.string().min(1, "Повторите пароль"),
    }),
    auth: "user",
  },
  async ({ currentPassword, newPassword, confirmPassword }, { session }) => {
    if (newPassword !== confirmPassword) throw new Error("Пароли не совпадают");
    if (newPassword === currentPassword) {
      throw new Error("Новый пароль должен отличаться от текущего");
    }

    const user = await db.user.findUnique({
      where: { id: session!.user.id },
      select: { id: true, passwordHash: true },
    });
    if (!user?.passwordHash) throw new Error("Не удалось сменить пароль");

    const ok = await verifyPassword(user.passwordHash, currentPassword);
    if (!ok) throw new Error("Текущий пароль неверен");

    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false },
    });
    return { ok: true };
  },
);
