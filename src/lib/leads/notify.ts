import type { EmailMessage } from "@/lib/email/send";
import { PLAN_LABELS, type LeadQuote } from "@/lib/leads/quote";
import { formatCurrency } from "@/lib/currency/format";
import { escapeHtml } from "@/lib/notify/escape";
import {
  CONTACT_LABELS,
  displayContact,
  webContactLink,
  type ContactType,
} from "@/lib/leads/contact";
import { countryTitle } from "@/lib/phone";
import { countryFlag } from "@/lib/analytics/format";
import { SITE_HOSTS } from "@/lib/seo/site-hosts";

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
  /** Офлайн — заявка на живой тренинг: без тарифа и расчёта. */
  format?: "ONLINE" | "OFFLINE";
  name?: string | null;
  /** Уже нормализованный контакт: E.164, `@username` или адрес почты. */
  contact: string;
  /** Куда писать. null — заявка до выбора канала (старые записи). */
  contactType?: ContactType | null;
  /** Страна номера (ISO) — может не совпадать с доменом заявки. */
  contactCountry?: string | null;
  /** Домен, с которого пришла заявка (SiteHost.code). */
  site?: string | null;
  siteHost?: string | null;
  /** Язык страницы заявки; русский не показываем — он и так по умолчанию. */
  locale?: "ru" | "kk" | "uz" | null;
  message?: string | null;
  company?: string | null;
  seatsWanted?: number | null;
  courseTitle?: string | null;
  /** Выбранный тариф и его цена — то, что человек видел на экране. */
  quote?: LeadQuote | null;
  createdAt: Date;
}

/**
 * Откуда пришла заявка: «🇧🇾 study.activesales.by». Домен и страна номера — разные
 * вещи: на белорусскую витрину заходят с казахстанским номером, и владельцу
 * важно видеть оба, чтобы не звонить среди ночи и не начинать не на том языке.
 */
function siteTitle(code: string | null | undefined, host?: string | null): string | null {
  if (!code) return null;
  const known = host ?? SITE_HOSTS.find((s) => s.code === code)?.host;
  return `${countryFlag(code)} ${known ?? code}`;
}

/** Страна номера с пометкой, если она расходится с доменом заявки. */
function phoneCountryLine(lead: LeadNotification): string | null {
  const title = countryTitle(lead.contactCountry);
  if (!title) return null;
  const mismatch =
    lead.site && lead.contactCountry && lead.site !== lead.contactCountry
      ? " ⚠️ другая страна, чем домен заявки"
      : "";
  return title + mismatch;
}

/** Язык страницы — только если он не русский: иначе это строка-шум в каждом уведомлении. */
const LOCALE_NAMES: Record<string, string> = { kk: "қазақша", uz: "o‘zbekcha" };
function localeLine(locale: string | null | undefined): string | null {
  return locale ? (LOCALE_NAMES[locale] ?? null) : null;
}

function line(label: string, value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  return `${label}: ${value}`;
}

/** «1 290 бел. руб.» — базовая валюта, кросс-курсы для уведомления не нужны. */
function br(tiyn: number): string {
  return formatCurrency(tiyn, "BYN", {});
}

/**
 * Тариф одной строкой: что выбрано и почём. Для B2B — цена места и годовой чек
 * с уровнем сетки, чтобы владелец шёл на звонок с готовой цифрой.
 */
export function quoteLine(quote: LeadQuote | null | undefined): string | null {
  if (!quote) return null;

  // Акция: показываем и зачёркнутую сумму — на звонке владельцу нужно знать,
  // от какой цены человек получил скидку.
  const promo = quote.fullTotalTiyn
    ? ` (акция −${quote.promoPercent}% от ${br(quote.fullTotalTiyn)})`
    : "";

  if (quote.plan === "COURSE") {
    return `💰 Тариф: курс, ${br(quote.totalTiyn)}${promo}`;
  }

  const subject = PLAN_LABELS[quote.plan];
  const perSeat = quote.perSeatTiyn ?? 0;
  const discount =
    quote.discount > 0
      ? ` (${quote.tierLabel ? `«${quote.tierLabel}», ` : ""}−${Math.round(quote.discount * 100)}%)`
      : "";
  const warn = quote.belowMinSeats ? "\n⚠️ Мест меньше минимального пакета — скидка не действует" : "";
  const trainer = quote.trainerTiyn
    ? `\n👨‍🏫 Пакет с тренером: 2 онлайн-сессии + группа сопровождения, ${br(quote.trainerTiyn)} к чеку`
    : "";

  return `💰 Тариф: ${subject}\n💵 Расчёт: ${br(perSeat)} × ${quote.seats} = ${br(quote.totalTiyn)}${discount}${promo}${trainer}${warn}`;
}

/**
 * Сообщение владельцу в Telegram (parse_mode=HTML): всё для звонка — в одном
 * экране, без похода в админку. Пользовательский ввод экранируем, иначе
 * «<директор>» в имени сломает разметку и Telegram отклонит сообщение.
 */
export function leadTelegramText(lead: LeadNotification, siteUrl?: string): string {
  const company = lead.company ? ` — ${escapeHtml(lead.company)}` : "";
  const title =
    lead.format === "OFFLINE"
      ? `🤝 <b>Заявка на офлайн-тренинг</b>${company}`
      : lead.kind === "B2B"
        ? `🏢 <b>Новая B2B-заявка</b>${company}`
        : `🎓 <b>Новая заявка на курс</b>${lead.courseTitle ? ` — ${escapeHtml(lead.courseTitle)}` : ""}`;

  // Канал связи в подписи: владелец сразу знает, где отвечать, и не пишет в
  // WhatsApp тому, кто оставил Telegram. Ссылка открывает диалог одним тапом
  // (у Viber схема не http — там остаётся только номер).
  const channel = lead.contactType ? CONTACT_LABELS[lead.contactType] : "Контакт";
  const channelIcon = lead.contactType === "EMAIL" ? "✉️" : "📞";
  const contactShown = lead.contactType
    ? displayContact(lead.contactType, lead.contact)
    : lead.contact;
  const writeLink = lead.contactType ? webContactLink(lead.contactType, lead.contact) : null;

  const rows = [
    line("👤 Имя", lead.name ? escapeHtml(lead.name) : null),
    // Контакт в <code> — удобно скопировать одним тапом.
    line(
      `${channelIcon} ${channel}`,
      `<code>${escapeHtml(contactShown)}</code>` +
        (writeLink ? ` — <a href="${writeLink}">написать</a>` : ""),
    ),
    line("🌍 Страна номера", phoneCountryLine(lead)),
    line("🌐 Заявка с домена", siteTitle(lead.site, lead.siteHost)),
    line("🗣 Язык страницы", localeLine(lead.locale)),
    line("🏢 Организация", lead.company ? escapeHtml(lead.company) : null),
    line(lead.format === "OFFLINE" ? "👥 Участников" : "💺 Мест", lead.seatsWanted),
    line("📚 Курс", lead.courseTitle ? escapeHtml(lead.courseTitle) : null),
    quoteLine(lead.quote),
    line("💬 Сообщение", lead.message ? escapeHtml(lead.message) : null),
  ].filter((l): l is string => l !== null);

  const footer = siteUrl ? `\n\n${siteUrl.replace(/\/$/, "")}/admin/leads` : "";
  return `${title}\n\n${rows.join("\n")}${footer}`;
}

/** Письмо владельцу: всё, что нужно для звонка, прямо в теле — без похода в админку. */
export function ownerLeadEmail(to: string, lead: LeadNotification): EmailMessage {
  const subject =
    lead.format === "OFFLINE"
      ? `Заявка на офлайн-тренинг${lead.company ? `: ${lead.company}` : ""}`
      : lead.kind === "B2B"
        ? `Новая B2B-заявка${lead.company ? `: ${lead.company}` : ""}`
        : `Новая заявка на курс${lead.courseTitle ? `: ${lead.courseTitle}` : ""}`;

  const text = [
    "Поступила новая заявка с сайта.",
    "",
    line(
      "Тип",
      lead.format === "OFFLINE"
        ? "Офлайн-тренинг (корпоративный)"
        : lead.kind === "B2B"
          ? "Корпоративная (B2B)"
          : "Розница (B2C)",
    ),
    line("Имя", lead.name),
    line(
      lead.contactType ? CONTACT_LABELS[lead.contactType] : "Контакт",
      lead.contactType ? displayContact(lead.contactType, lead.contact) : lead.contact,
    ),
    line("Страна номера", phoneCountryLine(lead)),
    line("Заявка с домена", siteTitle(lead.site, lead.siteHost)),
    line("Язык страницы", localeLine(lead.locale)),
    line("Организация", lead.company),
    line("Мест", lead.seatsWanted),
    line("Курс", lead.courseTitle),
    // В письме те же цифры, что и в Telegram, но без эмодзи-разметки.
    quoteLine(lead.quote)?.replace(/[💰💵⚠️]\s?/gu, ""),
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
  // Канал известен явно — на старых заявках его нет, поэтому остаётся разбор строки.
  const replyTo =
    lead.contactType === "EMAIL" ? lead.contact : lead.contactType ? null : contactEmail(lead.contact);
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
