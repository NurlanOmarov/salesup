import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";
import { countryFlag, countryName } from "@/lib/analytics/format";

/**
 * Телефонные номера в заявках: разбор, проверка и определение страны.
 *
 * Форма просит указать номер мессенджера, а не «телефон как получится»: без
 * международного кода WhatsApp номер не находит, а `+7 707…` и `+7 912…` —
 * это разные страны (Казахстан и Россия), которые по одному коду не различить.
 * Поэтому код страны выбирается флагом в поле ввода, а страну самого номера мы
 * определяем библиотечными метаданными и сохраняем в заявке: человек может
 * зайти на белорусский домен и оставить казахстанский номер.
 *
 * Модуль чистый (без server-only): им пользуются и поле ввода в браузере, и
 * серверный экшен — клиентскому значению доверять нельзя, сервер разбирает
 * номер заново.
 */

export type PhoneValidity = "empty" | "valid" | "invalid";

export interface ParsedPhone {
  /** E.164 (`+375291234567`) — пусто, если номер не разобран. */
  e164: string;
  /** Как показать в поле: «+375 29 123-45-67». */
  display: string;
  /** ISO-код страны номера (`BY`), null — определить не удалось. */
  country: CountryCode | null;
  validity: PhoneValidity;
}

/** Канонический домен — белорусский, с него и начинается список кодов. */
export const DEFAULT_PHONE_COUNTRY: CountryCode = "BY";

/** Страны в начале списка выбора — рынки платформы и ближнее зарубежье. */
export const PRIORITY_COUNTRIES: CountryCode[] = [
  "BY", "KZ", "RU", "UZ", "UA", "KG", "AZ", "AM", "GE", "MD", "LT", "LV", "PL", "TR", "AE", "DE", "US",
];

// Невидимые символы приходят вместе с номером, скопированным из мессенджера, и
// ломают разбор молча — вырезаем их до всего остального.
const INVISIBLE_RE = /[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;

export function cleanPhoneInput(value: string): string {
  return value.replace(INVISIBLE_RE, "").trim();
}

export function isSupportedCountry(code: string | null | undefined): code is CountryCode {
  if (!code || code.length !== 2) return false;
  return (getCountries() as string[]).includes(code.toUpperCase());
}

/** Код страны для набора: `BY` → `375`. */
export function callingCode(country: CountryCode): string {
  try {
    return getCountryCallingCode(country);
  } catch {
    return "";
  }
}

/**
 * Разобрать введённый номер в рамках выбранной страны.
 *
 * Страну задаёт флаг в поле (или международный код в самом номере) — перебирать
 * соседние страны нельзя: `303229605` формально годится сразу нескольким, и
 * заявка ушла бы с номером страны, которую человек не выбирал. Не подошедший
 * номер честнее отклонить и показать пример правильного.
 */
export function parsePhone(
  raw: string,
  country: CountryCode = DEFAULT_PHONE_COUNTRY,
): ParsedPhone {
  const cleaned = cleanPhoneInput(raw);
  if (!cleaned || cleaned === "+") {
    return { e164: "", display: cleaned, country: null, validity: "empty" };
  }

  let parsed = parsePhoneNumberFromString(cleaned, country);

  // Номер, записанный местным способом («8 029…», «+375 (0)29…»): ведущий ноль
  // после кода страны в E.164 не существует, но люди его пишут.
  if (!parsed?.isValid()) {
    const digits = cleaned.replace(/\D/g, "");
    if (cleaned.includes("+") && digits.startsWith("0")) {
      const national = digits.replace(/^0+/, "");
      parsed =
        parsePhoneNumberFromString(national, country) ??
        parsePhoneNumberFromString(`+${national}`, country) ??
        parsed;
    }
  }

  if (!parsed?.isValid()) {
    const formatter = new AsYouType(cleaned.startsWith("+") ? undefined : country);
    return {
      e164: "",
      display: formatter.input(cleaned) || cleaned,
      country: null,
      validity: "invalid",
    };
  }

  return {
    e164: parsed.format("E.164"),
    display: parsed.formatInternational(),
    country: (parsed.country as CountryCode | undefined) ?? null,
    validity: "valid",
  };
}

/** Страна уже сохранённого номера в E.164 — `+77071234567` → `KZ`. */
export function phoneCountry(e164: string): CountryCode | null {
  const parsed = parsePhoneNumberFromString(cleanPhoneInput(e164));
  return parsed?.isValid() ? ((parsed.country as CountryCode | undefined) ?? null) : null;
}

/** Читаемый вид сохранённого номера: «+375 29 123-45-67». */
export function formatPhone(e164: string): string {
  const parsed = parsePhoneNumberFromString(cleanPhoneInput(e164));
  return parsed?.isValid() ? parsed.formatInternational() : e164;
}

/** «🇰🇿 Казахстан» — для уведомления владельцу и карточки в админке. */
export function countryTitle(code: string | null | undefined): string | null {
  if (!isSupportedCountry(code)) return null;
  return `${countryFlag(code)} ${countryName(code)}`;
}

/** Полный список кодов: сначала наши рынки, затем всё остальное по алфавиту. */
export function countryOptions(): CountryCode[] {
  const all = getCountries();
  const rest = all
    .filter((c) => !PRIORITY_COUNTRIES.includes(c))
    .sort((a, b) => countryName(a).localeCompare(countryName(b), "ru"));
  return [...PRIORITY_COUNTRIES.filter((c) => all.includes(c)), ...rest];
}

/**
 * Плейсхолдер поля — пример номера страны в международном формате. Человек
 * сразу видит, что код страны обязателен: `0291234567` мессенджер не найдёт.
 * Для рынков платформы — реальный образец, для остальных достаточно кода.
 */
const EXAMPLES: Partial<Record<CountryCode, string>> = {
  BY: "+375 29 123 45 67",
  KZ: "+7 707 123 45 67",
  RU: "+7 912 345 67 89",
  UZ: "+998 90 123 45 67",
  UA: "+380 67 123 45 67",
  KG: "+996 555 123 456",
};

export function examplePhone(country: CountryCode): string {
  const code = callingCode(country);
  return EXAMPLES[country] ?? (code ? `+${code} …` : "+375 29 123 45 67");
}
