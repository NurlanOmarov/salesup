import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/env";
import { log } from "@/lib/log";

/**
 * Отправка писем через SMTP (S5.5). Используется только из обработчика задачи
 * `email.send` в worker-контейнере: приложение письма не шлёт, оно ставит задачу
 * в очередь (lib/jobs/enqueue), поэтому SMTP-секреты нужны лишь воркеру.
 *
 * ПДн (адрес получателя, содержимое) не логируем — CLAUDE.md, правило 9.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Куда отвечать (например, контакт заявителя). From всегда наш — Zoho и другие
   *  провайдеры отклоняют письмо, если отправитель не совпадает с учёткой SMTP. */
  replyTo?: string;
}

let cached: Transporter | null = null;

/** Транспорт создаётся один раз на процесс (пул соединений). */
function transporter(): Transporter {
  if (cached) return cached;
  if (!env.SMTP_HOST) throw new Error("SMTP_HOST не задан, а EMAIL_ENABLED=true");

  cached = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    // 465 — implicit TLS, остальные порты — STARTTLS.
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    pool: true,
  });
  return cached;
}

/**
 * Отправляет письмо. Бросает при ошибке SMTP — Job-runner повторит задачу
 * (максимум maxAttempts раз), поэтому вызывать только из обработчиков.
 */
export async function sendEmail(msg: EmailMessage): Promise<void> {
  const from = env.SMTP_FROM ?? env.SMTP_USER;
  if (!from) throw new Error("SMTP_FROM/SMTP_USER не заданы: некому подписать письмо");

  await transporter().sendMail({
    from,
    to: msg.to,
    subject: msg.subject,
    text: msg.text,
    html: msg.html,
    replyTo: msg.replyTo,
  });
  log.info({ subject: msg.subject }, "email.send: письмо отправлено");
}
