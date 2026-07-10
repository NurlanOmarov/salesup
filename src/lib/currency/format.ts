import type { RatesMap } from "./rates";

/**
 * Форматирование и конвертация цен для витрины. База — тенге (БД хранит priceTiyn,
 * 1 ₸ = 100 tiyn). Пересчёт в RUB/BYN — по курсу НБ РК (lib/currency/rates).
 *
 * Округление конвертируемых сумм — как в transfer-astana (_round_currency):
 *   RUB → ceil до 100, прочие (BYN) → ceil до 10. Базовая KZT-цена — точная
 *   (её задаёт админ), поэтому не округляется.
 */

export type CurrencyCode = "KZT" | "RUB" | "BYN";

/** Валюты, показываемые на витрине: казахстанский тенге, российский рубль, белорусский рубль. */
export const DISPLAY_CURRENCIES: CurrencyCode[] = ["KZT", "RUB", "BYN"];

const SYMBOLS: Record<CurrencyCode, string> = {
  KZT: "₸",
  RUB: "₽",
  BYN: "Br",
};

/**
 * Округление конвертируемой суммы (ceil до «красивого» шага).
 * Повторяет transfer-astana booking_service._round_currency.
 */
function roundForCurrency(amount: number, code: CurrencyCode): number {
  if (code === "RUB") return Math.ceil(amount / 100) * 100;
  if (code === "BYN") return Math.ceil(amount / 10) * 10;
  return amount; // KZT — базовая цена, без округления
}

/** tiyn (Int) → major units (₽/Br/₸) по курсу. 0 если курс недоступен. */
export function convertTiyn(
  tiyn: number,
  code: CurrencyCode,
  rates: RatesMap,
): number {
  const kzt = tiyn / 100; // 1 ₸ = 100 tiyn
  if (code === "KZT") return kzt;
  const rate = rates[code];
  if (!rate || rate <= 0) return 0;
  return roundForCurrency(kzt / rate, code);
}

/** Готовая строка цены в валюте, напр. «7 600 ₽». «—» при отсутствии курса. */
export function formatCurrency(
  tiyn: number,
  code: CurrencyCode,
  rates: RatesMap,
): string {
  const amount = convertTiyn(tiyn, code, rates);
  if (amount <= 0) return "—";
  return (
    Math.round(amount).toLocaleString("ru-RU", { maximumFractionDigits: 0 }) +
    " " +
    SYMBOLS[code]
  );
}

export interface MultiPrice {
  kzt: string;
  rub: string;
  byn: string;
  /** false, если курсы ещё не загружены (тогда RUB/BYN = «—»). */
  ready: boolean;
}

/** Три валюты разом — для карточек и блоков цены. */
export function buildMultiPrice(tiyn: number, rates: RatesMap): MultiPrice {
  const ready = !!(rates.RUB && rates.BYN);
  return {
    kzt: formatCurrency(tiyn, "KZT", rates),
    rub: formatCurrency(tiyn, "RUB", rates),
    byn: formatCurrency(tiyn, "BYN", rates),
    ready,
  };
}

/** Доступны ли курсы для пересчёта (RUB и BYN присутствуют). */
export function ratesAvailable(rates: RatesMap): boolean {
  return !!(rates.RUB && rates.BYN);
}
