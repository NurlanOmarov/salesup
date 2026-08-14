"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { signIn } from "@/auth";
import { db } from "@/lib/db";
import { LEGAL_VERSION } from "@/content/legal";
import { activateInvite, JoinError } from "@/lib/org/service";
import { clientIpFromHeaders, isLoginBlocked, recordLoginAttempt } from "@/lib/auth/login-attempts";
import { normalizeInviteCode } from "@/lib/org/seats";

/**
 * Самозапись работника организации по коду (оферта /offer-b2b, п. 4.2).
 *
 * Здесь платформа сознательно НЕ спрашивает ни имени, ни почты, ни телефона:
 * учётка создаётся под сгенерированным условным обозначением. Это и есть
 * техническая реализация обезличивания (docs/B2B-PLAN.md §5.1).
 */

const schema = z
  .object({
    code: z.string().trim().min(4, "Введите код"),
    password: z.string().min(8, "Пароль — минимум 8 символов"),
    passwordConfirm: z.string(),
    terms: z.literal("on", { errorMap: () => ({ message: "Подтвердите согласие" }) }),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    message: "Пароли не совпадают",
    path: ["passwordConfirm"],
  });

export interface JoinState {
  error?: string;
  login?: string;
}

export async function joinAction(
  _prev: JoinState,
  formData: FormData,
): Promise<JoinState> {
  const parsed = schema.safeParse({
    code: formData.get("code"),
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
    terms: formData.get("terms"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Проверьте поля" };
  }

  const code = normalizeInviteCode(parsed.data.code);
  const ip = clientIpFromHeaders(await headers());

  // Тот же rate-limit, что и на входе: код — это секрет, его можно перебирать.
  if (await isLoginBlocked(`join:${code}`, ip)) {
    return { error: "Слишком много попыток. Попробуйте через 15 минут." };
  }

  let result: { userId: string; login: string };
  try {
    result = await activateInvite({ code, password: parsed.data.password });
  } catch (e) {
    await recordLoginAttempt(`join:${code}`, ip, false);
    if (e instanceof JoinError) return { error: e.message };
    throw e;
  }

  await recordLoginAttempt(`join:${code}`, ip, true);

  // Акцепт политики фиксируем моментом и версией (Закон № 99-З); ПДн не пишем.
  await db.user.update({
    where: { id: result.userId },
    data: { termsAcceptedAt: new Date(), termsVersion: LEGAL_VERSION },
  });

  // Сразу входим под новой учёткой — работник не должен вводить логин, который
  // видит впервые. Логин показываем на следующем экране (он его и запомнит).
  await signIn("credentials", {
    identity: result.login,
    password: parsed.data.password,
    redirect: false,
  });

  return { login: result.login };
}
