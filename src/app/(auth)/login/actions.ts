"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn } from "@/auth";
import { db } from "@/lib/db";
import {
  clientIpFromHeaders,
  isLoginBlocked,
  recordLoginAttempt,
} from "@/lib/auth/login-attempts";
import { registerDevice } from "@/lib/antishare/devices";

const schema = z.object({
  email: z.string().email("Введите корректный e-mail"),
  password: z.string().min(1, "Введите пароль"),
  callbackUrl: z.string().optional(),
});

export interface LoginState {
  error?: string;
}

/** Server Action входа: rate-limit → проверка пароля → запись попытки → редирект. */
export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    callbackUrl: formData.get("callbackUrl") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Проверьте поля" };
  }
  const { email, password, callbackUrl } = parsed.data;
  const ip = clientIpFromHeaders(await headers());

  if (await isLoginBlocked(email, ip)) {
    return {
      error: "Слишком много попыток входа. Попробуйте через 15 минут.",
    };
  }

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (e) {
    if (e instanceof AuthError) {
      await recordLoginAttempt(email, ip, false);
      return { error: "Неверный e-mail или пароль" };
    }
    throw e;
  }

  await recordLoginAttempt(email, ip, true);

  // Редиректим напрямую: при навигации из server action клиентский роутер не
  // отображает промежуточный middleware-редирект, поэтому решаем назначение здесь.
  // (middleware остаётся как защита для прямых заходов.)
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, role: true, mustChangePassword: true },
  });

  // Антишаринг (S6.1): фиксируем устройство для выявления раздачи аккаунта.
  if (user) {
    try {
      const ua = (await headers()).get("user-agent") ?? "unknown";
      await registerDevice(user.id, ua, ip);
    } catch {
      // учёт устройства не должен мешать входу
    }
  }

  if (user?.mustChangePassword) redirect("/change-password");

  // Назначение по роли: владелец → консоль, ученик → кабинет (или callbackUrl).
  if (user?.role === "OWNER") {
    const ownerDest = callbackUrl && callbackUrl.startsWith("/admin") ? callbackUrl : "/admin";
    redirect(ownerDest);
  }
  const dest = callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : "/app";
  redirect(dest);
}
