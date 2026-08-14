"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { db } from "@/lib/db";
import {
  clientIpFromHeaders,
  isLoginBlocked,
  recordLoginAttempt,
} from "@/lib/auth/login-attempts";
import { registerDevice } from "@/lib/antishare/devices";
import { identityWhere, parseIdentity } from "@/lib/auth/identity";

const schema = z.object({
  identity: z.string().min(1, "Введите логин или e-mail"),
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
    identity: formData.get("identity"),
    password: formData.get("password"),
    callbackUrl: formData.get("callbackUrl") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Проверьте поля" };
  }
  const { password, callbackUrl } = parsed.data;
  const ip = clientIpFromHeaders(await headers());

  // Логин работника организации (acme-0042) или e-mail розничного ученика.
  const identity = parseIdentity(parsed.data.identity);
  if (!identity) return { error: "Неверный логин или пароль" };
  const identityValue = identity.value;

  if (await isLoginBlocked(identityValue, ip)) {
    return {
      error: "Слишком много попыток входа. Попробуйте через 15 минут.",
    };
  }

  try {
    await signIn("credentials", {
      identity: identityValue,
      password,
      redirect: false,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      await recordLoginAttempt(identityValue, ip, false);
      return { error: "Неверный логин или пароль" };
    }
    throw e;
  }

  await recordLoginAttempt(identityValue, ip, true);

  // Редиректим напрямую: при навигации из server action клиентский роутер не
  // отображает промежуточный middleware-редирект, поэтому решаем назначение здесь.
  // (middleware остаётся как защита для прямых заходов.)
  const user = await db.user.findUnique({
    where: identityWhere(identity),
    select: { id: true, role: true, mustChangePassword: true },
  });

  // Антишаринг (S6.1): фиксируем устройство и проверяем персональный лимит устройств.
  if (user) {
    let allowed = true;
    try {
      const ua = (await headers()).get("user-agent") ?? "unknown";
      const res = await registerDevice(user.id, ua, ip);
      allowed = res.allowed;
    } catch {
      // учёт устройства не должен мешать входу при технической ошибке
    }
    // Новое устройство сверх лимита: откатываем вход и просим обратиться к админу.
    if (!allowed) {
      await signOut({ redirect: false });
      return {
        error:
          "Достигнут лимит устройств для этого аккаунта. Войдите со знакомого устройства или обратитесь к администратору.",
      };
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
