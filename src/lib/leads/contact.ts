import { formatPhone, parsePhone, phoneCountry } from "@/lib/phone";

/**
 * Канал связи, который заявитель выбирает в форме.
 *
 * Раньше поле было одно — «телефон, WhatsApp или e-mail», — и человек оставлял
 * что угодно. Приходили заявки с одной почтой: письмо владелец видит поздно, а
 * позвонить или написать в мессенджер некуда, и клиент остывает. Теперь канал
 * выбирается явно, по умолчанию — мессенджер, а значение приводится к формату
 * канала: телефон — только в E.164, чтобы WhatsApp/Viber его нашли.
 *
 * Модуль чистый: одни и те же правила действуют в форме и в серверном экшене
 * (клиентской проверке верить нельзя — она лишь подсказка).
 */

export const CONTACT_TYPES = ["WHATSAPP", "TELEGRAM", "VIBER", "EMAIL"] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

/** Мессенджеры идут первыми: по ним отвечают за минуты, а не за сутки. */
export const DEFAULT_CONTACT_TYPE: ContactType = "WHATSAPP";

export const CONTACT_LABELS: Record<ContactType, string> = {
  WHATSAPP: "WhatsApp",
  TELEGRAM: "Telegram",
  VIBER: "Viber",
  EMAIL: "E-mail",
};

const EMAIL_RE = /^[^\s@]+@[^\s@,;]+\.[a-z]{2,}$/i;
const TG_USERNAME_RE = /^[a-zA-Z][a-zA-Z0-9_]{3,31}$/;

/** Убрать из ввода t.me/@ и прочий мусор, оставить чистый username. */
export function normalizeTelegramUsername(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^(www\.)?(t(elegram)?\.me|telegram\.dog)\//i, "")
    .replace(/^@+/, "")
    .replace(/[^a-zA-Z0-9_]/g, "");
}

export function isValidTelegramUsername(raw: string): boolean {
  return TG_USERNAME_RE.test(normalizeTelegramUsername(raw));
}

export function isValidEmail(raw: string): boolean {
  return EMAIL_RE.test(raw.trim());
}

export interface NormalizedContact {
  /** Значение канала: E.164, `@username` или адрес почты. */
  value: string;
  /** Страна номера (`KZ`) — только для телефонных каналов. */
  country: string | null;
}

/**
 * Привести контакт к формату канала. `null` — значение каналу не подходит:
 * заявку в этом случае не сохраняем, иначе владелец получит номер, по которому
 * не дозвониться.
 */
export function normalizeContact(type: ContactType, raw: string): NormalizedContact | null {
  const value = raw.trim();
  if (!value) return null;

  if (type === "EMAIL") {
    return isValidEmail(value) ? { value: value.toLowerCase(), country: null } : null;
  }

  // Telegram — единственный канал, где вместо номера может быть ник.
  if (type === "TELEGRAM" && !value.startsWith("+") && !/^\d/.test(value)) {
    const username = normalizeTelegramUsername(value);
    return isValidTelegramUsername(username) ? { value: `@${username}`, country: null } : null;
  }

  const parsed = parsePhone(value);
  if (parsed.validity !== "valid") return null;
  return { value: parsed.e164, country: parsed.country ?? phoneCountry(parsed.e164) };
}

/** Подсказка, что именно не так — её видит заявитель в форме. */
export const CONTACT_ERRORS: Record<ContactType, string> = {
  WHATSAPP: "Укажите номер WhatsApp с кодом страны — например +375 29 123 45 67",
  TELEGRAM: "Укажите @username или номер Telegram с кодом страны",
  VIBER: "Укажите номер Viber с кодом страны — например +375 29 123 45 67",
  EMAIL: "Проверьте адрес e-mail",
};

/** Телефонный ли это контакт (у Telegram зависит от того, что оставили). */
export function isPhoneContact(type: ContactType, value: string): boolean {
  return type !== "EMAIL" && value.trim().startsWith("+");
}

/** Ссылка «написать» для владельца: открывает нужный канал сразу на диалоге. */
export function contactLink(type: ContactType, value: string): string {
  const v = value.trim();
  const digits = v.replace(/\D/g, "");
  if (type === "EMAIL") return `mailto:${v}`;
  if (type === "WHATSAPP") return `https://wa.me/${digits}`;
  if (type === "VIBER") return `viber://chat?number=%2B${digits}`;
  return v.startsWith("@") ? `https://t.me/${v.slice(1)}` : `https://t.me/+${digits}`;
}

/**
 * Ссылка для сообщения и кнопок Telegram-бота: там разрешены только http(s),
 * поэтому у Viber берём веб-редирект `viber.click`, а не схему `viber://`.
 * У почты http-варианта нет — вернётся null, адрес останется текстом.
 *
 * `text` — заготовка первого сообщения: владелец жмёт кнопку и сразу отправляет,
 * ничего не набирая. WhatsApp и Viber её принимают, Telegram — нет.
 */
export function webContactLink(
  type: ContactType,
  value: string,
  text?: string | null,
): string | null {
  const digits = value.trim().replace(/\D/g, "");
  const query = text ? `?text=${encodeURIComponent(text)}` : "";

  if (type === "WHATSAPP") return `https://wa.me/${digits}${query}`;
  if (type === "VIBER") return digits ? `https://viber.click/${digits}${query}` : null;
  if (type === "TELEGRAM") return contactLink(type, value);
  return null;
}

/** Как показать контакт человеку: номер — разбитым на группы, ник и почту — как есть. */
export function displayContact(type: ContactType, value: string): string {
  return isPhoneContact(type, value) ? formatPhone(value) : value;
}
