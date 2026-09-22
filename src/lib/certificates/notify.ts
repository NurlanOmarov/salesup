import type { TelegramButton } from "@/lib/notify/telegram";
import { escapeHtml } from "@/lib/notify/escape";

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
    "Ученик прошёл курс. Дальше он оставит отзыв и запросит сертификат.",
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
  // Работник организации запрашивает сертификат через ответственного клиента,
  // розничный ученик — письмом с ФИО: владелец сразу знает, чего ждать.
  const next = input.learner.orgName
    ? "Сертификат запросит ответственный представитель компании."
    : "Ждите письмо с ФИО для сертификата.";
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
