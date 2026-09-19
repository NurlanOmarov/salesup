import { db } from "@/lib/db";
import { env } from "@/env";
import { log } from "@/lib/log";
import { sendEmail } from "@/lib/email/send";
import { emailSupportLinks } from "@/lib/email/support";
import { passwordChangedEmail, passwordResetEmail } from "@/lib/email/templates";
import { matchSiteHost } from "@/lib/seo/site-hosts";
import { issueResetToken, RESET_TTL_MINUTES } from "@/lib/auth/password-reset";

/**
 * Отправка письма со ссылкой сброса пароля. Выполняется только в воркере (нужен
 * SMTP), по задаче `auth.send-reset`. Токен создаётся ЗДЕСЬ и в очередь не
 * попадает: в payload задачи только адрес и домен, ссылку из таблицы Job
 * собрать нельзя.
 *
 * Ответ формы одинаков для существующего и несуществующего адреса (иначе форма
 * стала бы способом узнать, кто зарегистрирован), поэтому «нет такого ученика»
 * здесь — тихий выход, а не ошибка.
 */

/** Домен ссылки — только наш: значение приходит из заголовка запроса. */
function safeOrigin(candidate: string | undefined): string {
  try {
    const host = candidate ? new URL(candidate).host : null;
    if (matchSiteHost(host)) return new URL(candidate!).origin;
  } catch {
    // невалидный адрес — падаем на каноническую витрину
  }
  return env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
}

export async function sendPasswordResetEmail(input: {
  email: string;
  siteUrl?: string;
}): Promise<void> {
  if (!env.EMAIL_ENABLED) {
    log.info("auth.send-reset пропущена: EMAIL_ENABLED=false");
    return;
  }

  // Владельца платформы по почте не восстанавливаем: его учётка открывает всё,
  // и её пароль меняется только осознанно, вне публичной формы.
  const user = await db.user.findFirst({
    where: {
      email: { equals: input.email, mode: "insensitive" },
      deletedAt: null,
      role: "STUDENT",
    },
    select: { email: true },
  });
  if (!user?.email) {
    log.info("auth.send-reset: подходящей учётки нет — письмо не отправлено");
    return;
  }

  const origin = safeOrigin(input.siteUrl);
  const token = await issueResetToken(user.email);
  const mail = passwordResetEmail({
    resetUrl: `${origin}/reset-password?token=${token}`,
    ttlMinutes: RESET_TTL_MINUTES,
    support: emailSupportLinks(),
  });
  await sendEmail({ to: user.email, ...mail });
  log.info("auth.send-reset: письмо со ссылкой отправлено");
}

/** «Пароль изменён» — сообщение безопасности; ошибки отправки не критичны. */
export async function sendPasswordChangedEmail(email: string): Promise<void> {
  if (!env.EMAIL_ENABLED) return;
  const mail = passwordChangedEmail({ support: emailSupportLinks() });
  await sendEmail({ to: email, ...mail });
}
