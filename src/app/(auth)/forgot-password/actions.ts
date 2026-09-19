"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { env } from "@/env";
import { enqueue } from "@/lib/jobs/enqueue";
import {
  RESET_MAX_REQUESTS_PER_HOUR,
  recentResetRequests,
  SEND_RESET_JOB,
} from "@/lib/auth/password-reset";
import { matchSiteHost } from "@/lib/seo/site-hosts";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Введите корректный e-mail"),
});

export interface ForgotState {
  error?: string;
  sent?: boolean;
}

/**
 * Запрос ссылки для сброса пароля. Отвечает ОДИНАКОВО для любого корректного
 * адреса — есть такая учётка или нет: иначе форма выдавала бы, кто у нас учится.
 * Само письмо ставится в очередь и уходит из воркера.
 */
export async function requestPasswordResetAction(
  _prev: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  const parsed = schema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Проверьте адрес" };
  }
  const { email } = parsed.data;

  if (!env.EMAIL_ENABLED) {
    return {
      error:
        "Восстановление по почте сейчас недоступно. Напишите в поддержку — мы выдадим новый пароль.",
    };
  }

  // Ссылка должна вести на тот домен, где человек просил письмо (у нас их четыре).
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const site = matchSiteHost(host);
  const siteUrl = site ? `https://${site.host}` : env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");

  // Лимит писем на адрес: сверх него молча не отправляем, но и не сообщаем об этом.
  if ((await recentResetRequests(email)) < RESET_MAX_REQUESTS_PER_HOUR) {
    await enqueue(SEND_RESET_JOB, { email, siteUrl }, { maxAttempts: 3 });
  }

  return { sent: true };
}
