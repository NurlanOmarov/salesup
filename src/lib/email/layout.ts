/**
 * Общая вёрстка писем платформы. Только строки — без React и без обращения к
 * окружению, поэтому модуль чистый и тестируется без БД и SMTP.
 *
 * Почтовые клиенты режут современный CSS: вёрстка табличная, стили — инлайновые,
 * ширина 600 px, никаких внешних картинок (их блокирует Gmail и Outlook до
 * нажатия «показать»), а шрифт — системный. Логотип — словом, не картинкой.
 *
 * Каждый блок принимает ОБЫЧНЫЙ текст и сам его экранирует; «сырой» HTML
 * принимают только сборщики верхнего уровня (`shell`, `card`), куда попадают
 * уже готовые блоки.
 */

const C = {
  brand: "#f4003a",
  brandSoft: "#fff1f4",
  text: "#1f2328",
  muted: "#6b7280",
  line: "#e5e7eb",
  page: "#f4f4f5",
  card: "#ffffff",
  soft: "#f8f8f9",
  warnBg: "#fff8e6",
  warnLine: "#f0c36d",
  warnText: "#7a5200",
  infoBg: "#f1f6ff",
  infoLine: "#b9d0f5",
  infoText: "#1d4a8f",
} as const;

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
const MONO = "'SFMono-Regular',Menlo,Consolas,'Liberation Mono',monospace";

/** Экранирование для HTML-текста и атрибутов. */
export function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Абзац обычного текста. */
export function para(text: string, opts: { muted?: boolean; small?: boolean } = {}): string {
  const size = opts.small ? 13 : 15;
  const color = opts.muted ? C.muted : C.text;
  return `<p style="margin:0 0 14px;font-size:${size}px;line-height:1.6;color:${color};">${esc(text)}</p>`;
}

/** Заголовок раздела внутри письма. */
export function sectionTitle(text: string): string {
  return `<h2 style="margin:26px 0 8px;font-size:17px;line-height:1.35;color:${C.text};">${esc(text)}</h2>`;
}

/** Плашка-пояснение: info — «что это», warn — «не потеряйте». */
export function note(text: string, tone: "info" | "warn" = "info"): string {
  const bg = tone === "warn" ? C.warnBg : C.infoBg;
  const line = tone === "warn" ? C.warnLine : C.infoLine;
  const color = tone === "warn" ? C.warnText : C.infoText;
  return (
    `<div style="margin:0 0 16px;padding:12px 14px;background:${bg};border:1px solid ${line};` +
    `border-radius:10px;font-size:14px;line-height:1.55;color:${color};">${esc(text)}</div>`
  );
}

/** Маркированный список. */
export function bullets(items: string[]): string {
  const lis = items
    .map((t) => `<li style="margin:0 0 6px;">${esc(t)}</li>`)
    .join("");
  return `<ul style="margin:0 0 14px;padding-left:20px;font-size:15px;line-height:1.55;color:${C.text};">${lis}</ul>`;
}

/** Нумерованные шаги. */
export function steps(items: string[]): string {
  const lis = items
    .map((t) => `<li style="margin:0 0 8px;">${esc(t)}</li>`)
    .join("");
  return `<ol style="margin:0 0 14px;padding-left:22px;font-size:15px;line-height:1.55;color:${C.text};">${lis}</ol>`;
}

/**
 * Блок с данными для входа. Значение — моноширинным крупным шрифтом: пароль
 * читают глазами и вбивают руками, путать «l» и «1» нельзя (генератор паролей
 * и так исключает похожие символы, см. lib/auth/temp-password).
 */
export function credentialsBox(rows: { label: string; value: string }[]): string {
  const trs = rows
    .map(
      (r, i) =>
        `<tr><td style="padding:${i === 0 ? "14px" : "4px"} 16px 0;font-size:12px;color:${C.muted};` +
        `text-transform:uppercase;letter-spacing:.04em;">${esc(r.label)}</td></tr>` +
        `<tr><td style="padding:2px 16px ${i === rows.length - 1 ? "14px" : "6px"};font-family:${MONO};` +
        `font-size:18px;font-weight:600;color:${C.text};word-break:break-all;">${esc(r.value)}</td></tr>`,
    )
    .join("");
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ` +
    `style="margin:0 0 16px;background:${C.soft};border:1px solid ${C.line};border-radius:10px;">${trs}</table>`
  );
}

/** Кнопка-ссылка. Табличная, чтобы держать форму в Outlook. */
export function button(label: string, href: string): string {
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;"><tr>` +
    `<td style="background:${C.brand};border-radius:10px;">` +
    `<a href="${esc(href)}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;` +
    `color:#ffffff;text-decoration:none;">${esc(label)}</a></td></tr></table>`
  );
}

/** Простая таблица данных: шапка + строки; колонки из monoCols рисуются моноширинным. */
export function dataTable(
  headers: string[],
  rows: string[][],
  opts: { monoCols?: number[] } = {},
): string {
  const mono = new Set(opts.monoCols ?? []);
  const th = headers
    .map(
      (h) =>
        `<th align="left" style="padding:8px 10px;font-size:12px;font-weight:600;color:${C.muted};` +
        `background:${C.soft};border-bottom:1px solid ${C.line};">${esc(h)}</th>`,
    )
    .join("");
  const body = rows
    .map(
      (r) =>
        `<tr>${r
          .map(
            (cell, i) =>
              `<td style="padding:8px 10px;font-size:${mono.has(i) ? 14 : 13}px;color:${C.text};` +
              `border-bottom:1px solid ${C.line};${mono.has(i) ? `font-family:${MONO};` : ""}">${esc(cell)}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ` +
    `style="margin:0 0 16px;border:1px solid ${C.line};border-radius:10px;border-collapse:separate;">` +
    `<thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`
  );
}

/**
 * Карточка-раздел с цветной полосой слева и подписью «для кого». Нужна там, где
 * в одном письме несколько разных учёток: у каждой свой смысл, и человек не
 * должен гадать, что для чего.
 */
export function card(params: { badge: string; title: string; bodyHtml: string }): string {
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ` +
    `style="margin:0 0 18px;border:1px solid ${C.line};border-left:4px solid ${C.brand};border-radius:10px;">` +
    `<tr><td style="padding:16px 18px 4px;">` +
    `<span style="display:inline-block;padding:3px 9px;background:${C.brandSoft};color:${C.brand};` +
    `font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;border-radius:20px;">${esc(params.badge)}</span>` +
    `<h2 style="margin:10px 0 8px;font-size:18px;line-height:1.35;color:${C.text};">${esc(params.title)}</h2>` +
    `</td></tr><tr><td style="padding:0 18px 6px;">${params.bodyHtml}</td></tr></table>`
  );
}

/** Ссылки поддержки в подвале: «WhatsApp: …». */
export interface SupportLink {
  label: string;
  href: string;
}

export function shell(params: {
  /** Текст-превью в списке писем: показывается серым рядом с темой. */
  preheader: string;
  heading: string;
  bodyHtml: string;
  support?: SupportLink[];
  /** Пояснение, почему пришло письмо, — в подвале. */
  reason?: string;
}): string {
  const support =
    params.support && params.support.length > 0
      ? `<p style="margin:0 0 6px;font-size:13px;line-height:1.6;color:${C.muted};">Нужна помощь? ` +
        params.support
          .map((l) => `<a href="${esc(l.href)}" style="color:${C.brand};text-decoration:none;">${esc(l.label)}</a>`)
          .join(" · ") +
        `</p>`
      : "";
  const reason = params.reason
    ? `<p style="margin:0;font-size:12px;line-height:1.6;color:${C.muted};">${esc(params.reason)}</p>`
    : "";

  return (
    `<!doctype html><html lang="ru"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="color-scheme" content="light"><title>${esc(params.heading)}</title></head>` +
    `<body style="margin:0;padding:0;background:${C.page};font-family:${FONT};">` +
    // Прехедер: скрытый текст, который почтовик показывает в списке писем.
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(params.preheader)}</div>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page};">` +
    `<tr><td align="center" style="padding:24px 12px;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">` +
    `<tr><td style="padding:0 4px 14px;font-size:15px;font-weight:800;letter-spacing:.08em;color:${C.text};">` +
    `ACTIVE <span style="color:${C.brand};">SALES</span></td></tr>` +
    `<tr><td style="background:${C.card};border:1px solid ${C.line};border-radius:14px;padding:28px 26px 14px;">` +
    `<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${C.text};">${esc(params.heading)}</h1>` +
    `${params.bodyHtml}</td></tr>` +
    `<tr><td style="padding:16px 6px 0;">${support}${reason}</td></tr>` +
    `</table></td></tr></table></body></html>`
  );
}

/**
 * Текстовые ссылки поддержки для письма: телефон и WhatsApp страны, Telegram
 * из окружения. Страна — по коду рынка (BY/KZ/RU/UZ); на витрине Узбекистана
 * телефона нет вовсе, и блок честно рисуется без него.
 */
export function supportLinks(params: {
  whatsapp: string | null;
  phone: string | null;
  telegram: string | null;
}): SupportLink[] {
  const links: SupportLink[] = [];
  if (params.whatsapp) links.push({ label: "WhatsApp", href: params.whatsapp });
  if (params.telegram) {
    links.push({
      label: "Telegram",
      href: params.telegram.startsWith("http")
        ? params.telegram
        : `https://t.me/${params.telegram.replace(/^@/, "")}`,
    });
  }
  if (params.phone) {
    links.push({ label: params.phone, href: `tel:${params.phone.replace(/[^\d+]/g, "")}` });
  }
  return links;
}

/** Ссылки поддержки в текстовой версии письма. */
export function supportText(links: SupportLink[]): string {
  return links.length > 0
    ? `Нужна помощь? ${links.map((l) => (l.href.startsWith("tel:") ? l.label : `${l.label}: ${l.href}`)).join(" · ")}`
    : "";
}
