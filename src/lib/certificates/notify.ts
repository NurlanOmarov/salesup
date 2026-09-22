import type { TelegramButton } from "@/lib/notify/telegram";
import { escapeHtml } from "@/lib/notify/escape";
import { passedVerb } from "./holder.js";

/**
 * Уведомления владельцу по пути к сертификату: сертификат готов и ученик оставил
 * отзыв. Без них владелец узнавал о запросе только из письма с ФИО или из
 * админки — а письмо могло и не дойти. Только формирование текста — отправка
 * через очередь `telegram.send`, модуль чистый и покрыт тестами.
 *
 * Кого показываем: розничного ученика — по e-mail (владельцу нужен контакт, чтобы
 * выдать документ), работника организации — по логину и названию клиента: его ПДн
 * у платформы нет (CLAUDE.md, правило 9).
 */

export interface CertificateLearner {
  email: string | null;
  login: string | null;
  orgName: string | null;
}

function learnerLine(l: CertificateLearner): string {
  if (l.orgName) {
    return `🏢 ${escapeHtml(l.orgName)}${l.login ? ` · <code>${escapeHtml(l.login)}</code>` : ""}`;
  }
  return `👤 <code>${escapeHtml(l.email ?? l.login ?? "—")}</code>`;
}

export function certificateReadyTelegramText(input: {
  courseTitle: string;
  scorePct: number | null;
  learner: CertificateLearner;
}): string {
  const score = input.scorePct != null ? ` · экзамен ${input.scorePct}%` : "";
  return [
    `🎓 <b>Сертификат готов к выдаче</b>`,
    "",
    `📚 ${escapeHtml(input.courseTitle)}${score}`,
    learnerLine(input.learner),
    "",
    "Ученик прошёл курс. Дальше он оставит отзыв, введёт ФИО — и сертификат выпустится сам.",
  ].join("\n");
}

/** Отзыв в уведомлении — не длиннее этого: целиком он в админке. */
const REVIEW_PREVIEW = 400;

export function reviewTelegramText(input: {
  courseTitle: string;
  rating: number;
  text: string;
  published: boolean;
  learner: CertificateLearner;
}): string {
  const stars = "★".repeat(input.rating) + "☆".repeat(Math.max(0, 5 - input.rating));
  const body =
    input.text.length > REVIEW_PREVIEW ? `${input.text.slice(0, REVIEW_PREVIEW)}…` : input.text;
  const next = "Следующий шаг ученика — ввести ФИО: сертификат выпустится и уйдёт на почту автоматически.";
  return [
    `⭐ <b>Новый отзыв о курсе</b> ${stars}`,
    "",
    `📚 ${escapeHtml(input.courseTitle)}`,
    learnerLine(input.learner),
    input.published ? "✅ Опубликован на странице курса" : "🔒 Не опубликован (нет согласия или модерация)",
    "",
    `«${escapeHtml(body)}»`,
    "",
    next,
  ].join("\n");
}

export function certificateTelegramButtons(siteUrl?: string): TelegramButton[][] {
  if (!siteUrl) return [];
  const base = siteUrl.replace(/\/$/, "");
  return [[{ text: "🎓 Сертификаты в админке", url: `${base}/admin/certificates` }]];
}

export function certificateIssuedTelegramText(input: {
  courseTitle: string;
  number: string;
  learner: CertificateLearner;
}): string {
  const to = input.learner.orgName
    ? "PDF отправлен ответственному представителю компании."
    : "PDF отправлен ученику на почту.";
  return [
    `✅ <b>Сертификат выдан</b> № ${escapeHtml(input.number)}`,
    "",
    `📚 ${escapeHtml(input.courseTitle)}`,
    learnerLine(input.learner),
    "",
    to,
  ].join("\n");
}

/**
 * Письмо с PDF сертификата. B2B — ответственному представителю клиента: он
 * получает документ работника (оферта /offer-b2b, п. 10.5). Розница — самому ученику.
 */
export function certificateEmail(input: {
  to: string;
  holderName: string;
  courseTitle: string;
  number: string;
  verifyUrl: string;
  orgName: string | null;
  label: string | null;
}): { to: string; subject: string; text: string } {
  const subject = `Сертификат № ${input.number} — «${input.courseTitle}»`;
  const text = input.orgName
    ? [
        "Здравствуйте!",
        "",
        `Работник вашей компании ${input.holderName}${input.label ? ` (${input.label})` : ""} ${passedVerb(input.holderName)} курс «${input.courseTitle}» и получил сертификат № ${input.number}.`,
        "Сертификат — во вложении (PDF). Работник также может открыть и скачать его в своём кабинете, в разделе «Сертификаты».",
        "",
        `Проверить подлинность: ${input.verifyUrl}`,
        "",
        "ACTIVE SALES",
      ].join("\n")
    : [
        "Здравствуйте!",
        "",
        `Поздравляем с окончанием курса «${input.courseTitle}»! Ваш сертификат № ${input.number} — во вложении (PDF).`,
        "Он всегда доступен в личном кабинете, в разделе «Сертификаты».",
        "",
        `Проверить подлинность: ${input.verifyUrl}`,
        "",
        "ACTIVE SALES",
      ].join("\n");
  return { to: input.to, subject, text };
}
