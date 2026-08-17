import type { EmailMessage } from "@/lib/email/send";
import { escapeHtml } from "@/lib/notify/escape";

/**
 * Уведомления по новой заявке с публичной формы. Основной канал — сообщение
 * владельцу в Telegram (чтобы он перезвонил и выдал доступ — оплаты онлайн нет).
 * Письма оставлены на будущее: включаются флагом EMAIL_ENABLED.
 *
 * Только формирование текста — отправка идёт через очередь (`telegram.send`,
 * `email.send`), поэтому модуль чистый и покрыт unit-тестами.
 */

/** Достаточно строгая проверка: адрес без пробелов, с одним @ и точкой в домене. */
const EMAIL_RE = /^[^\s@]+@[^\s@,;]+\.[a-z]{2,}$/i;

/** Вернуть e-mail, если человек оставил в контакте именно почту (иначе null). */
export function contactEmail(contact: string): string | null {
  const value = contact.trim();
  return EMAIL_RE.test(value) ? value : null;
}

export interface LeadNotification {
  kind: "B2C" | "B2B";
  name?: string | null;
  contact: string;
  message?: string | null;
  company?: string | null;
  seatsWanted?: number | null;
  courseTitle?: string | null;
  createdAt: Date;
}

function line(label: string, value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  return `${label}: ${value}`;
}

/**
 * Сообщение владельцу в Telegram (parse_mode=HTML): всё для звонка — в одном
 * экране, без похода в админку. Пользовательский ввод экранируем, иначе
 * «<директор>» в имени сломает разметку и Telegram отклонит сообщение.
 */
export function leadTelegramText(lead: LeadNotification, siteUrl?: string): string {
  const title =
    lead.kind === "B2B"
      ? `🏢 <b>Новая B2B-заявка</b>${lead.company ? ` — ${escapeHtml(lead.company)}` : ""}`
      : `🎓 <b>Новая заявка на курс</b>${lead.courseTitle ? ` — ${escapeHtml(lead.courseTitle)}` : ""}`;

  const rows = [
    line("👤 Имя", lead.name ? escapeHtml(lead.name) : null),
    // Контакт в <code> — удобно скопировать одним тапом.
    line("📞 Контакт", `<code>${escapeHtml(lead.contact)}</code>`),
    line("🏢 Организация", lead.company ? escapeHtml(lead.company) : null),
    line("💺 Мест", lead.seatsWanted),
    line("📚 Курс", lead.courseTitle ? escapeHtml(lead.courseTitle) : null),
    line("💬 Сообщение", lead.message ? escapeHtml(lead.message) : null),
  ].filter((l): l is string => l !== null);

  const footer = siteUrl ? `\n\n${siteUrl.replace(/\/$/, "")}/admin/leads` : "";
  return `${title}\n\n${rows.join("\n")}${footer}`;
}

/** Письмо владельцу: всё, что нужно для звонка, прямо в теле — без похода в админку. */
export function ownerLeadEmail(to: string, lead: LeadNotification): EmailMessage {
  const subject =
    lead.kind === "B2B"
      ? `Новая B2B-заявка${lead.company ? `: ${lead.company}` : ""}`
      : `Новая заявка на курс${lead.courseTitle ? `: ${lead.courseTitle}` : ""}`;

  const text = [
    "Поступила новая заявка с сайта.",
    "",
    line("Тип", lead.kind === "B2B" ? "Корпоративная (B2B)" : "Розница (B2C)"),
    line("Имя", lead.name),
    line("Контакт", lead.contact),
    line("Организация", lead.company),
    line("Мест", lead.seatsWanted),
    line("Курс", lead.courseTitle),
    line("Сообщение", lead.message),
    line("Дата", lead.createdAt.toISOString()),
    "",
    "Заявка сохранена в админке: /admin/leads",
  ]
    .filter((l): l is string => l !== null)
    .join("\n");

  // Ответить заявителю можно прямо из почты — если он оставил e-mail.
  // Ключ добавляем только при наличии адреса: payload задачи хранится как JSON,
  // где значения undefined недопустимы.
  const replyTo = contactEmail(lead.contact);
  return { to, subject, text, ...(replyTo ? { replyTo } : {}) };
}

/** Подтверждение заявителю — только если контактом он оставил e-mail. */
export function applicantLeadEmail(to: string, lead: LeadNotification): EmailMessage {
  const greeting = lead.name ? `${lead.name}, здравствуйте!` : "Здравствуйте!";
  const about = lead.courseTitle ? `на курс «${lead.courseTitle}»` : "на обучение";

  const text = [
    greeting,
    "",
    `Мы получили вашу заявку ${about}. Спасибо!`,
    "Мы свяжемся с вами по указанному контакту, чтобы уточнить детали и открыть доступ.",
    "",
    "Если заявка отправлена по ошибке — просто проигнорируйте это письмо.",
    "",
    "ACTIVE SALES",
  ].join("\n");

  return { to, subject: "Ваша заявка принята — ACTIVE SALES", text };
}
