import type { RatesMap } from "./rates";

/**
 * Форматирование и конвертация цен для витрины. База — белорусский рубль (БД хранит
 * priceTiyn; имя поля историческое, по факту — BYN-копейки, 1 Br = 100 tiyn). Курсы
 * НБ РК (lib/currency/rates) заданы как «1 ед. валюты = X тенге», поэтому KZT/RUB
 * пересчитываются из BYN через кросс-курс: BYN → KZT (rates.BYN) → нужная валюта.
 *
 * Округление конвертируемых сумм — как в transfer-astana (_round_currency):
 *   KZT/RUB → ceil до 100. Базовая BYN-цена — точная (её задаёт админ), поэтому
 *   не округляется.
 */

export type CurrencyCode = "KZT" | "RUB" | "BYN";

/** Валюты, показываемые на витрине: белорусский рубль (основная), тенге, российский рубль. */
export const DISPLAY_CURRENCIES: CurrencyCode[] = ["BYN", "KZT", "RUB"];

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
  if (code === "KZT" || code === "RUB") return Math.ceil(amount / 100) * 100;
  return amount; // BYN — базовая цена, без округления
}

/** tiyn (Int, BYN-копейки) → major units (Br/₸/₽) по курсу. 0 если курс недоступен. */
export function convertTiyn(
  tiyn: number,
  code: CurrencyCode,
  rates: RatesMap,
): number {
  const byn = tiyn / 100; // 1 Br = 100 tiyn
  if (code === "BYN") return byn;
  const bynRate = rates.BYN; // 1 BYN = X KZT
  if (!bynRate || bynRate <= 0) return 0;
  const kzt = byn * bynRate;
  if (code === "KZT") return roundForCurrency(kzt, code);
  const rate = rates[code]; // 1 <code> = X KZT
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
  // Неразрывный пробел перед символом: с обычным «147 800 ₸» переносится знаком
  // валюты на следующую строку, и цифра выглядит оборванной.
  return (
    Math.round(amount).toLocaleString("ru-RU", { maximumFractionDigits: 0 }) +
    "\u00A0" +
    SYMBOLS[code]
  );
}

export interface MultiPrice {
  kzt: string;
  rub: string;
  byn: string;
  /** Цена в валюте страны домена — её посетитель видит крупно. */
  main: string;
  /** Остальные валюты одной строкой: «≈ 1 000 Br · ≈ 30 000 ₽». Пусто, пока нет курса. */
  alt: string;
  /** false, если кросс-курс ещё не загружен (тогда KZT/RUB = «—»). */
  ready: boolean;
}

/** Валюта витрины по домену (мультидомен): ключ поля MultiPrice. */
export type MainCurrency = "byn" | "kzt" | "rub";

/**
 * Три валюты разом — для карточек и блоков цены. main — валюта страны домена:
 * казахстанскому посетителю цена показывается в тенге, российскому в рублях,
 * остальные остаются справочными (цена договора — BYN, см. оферту).
 */
export function buildMultiPrice(
  tiyn: number,
  rates: RatesMap,
  main: MainCurrency = "byn",
): MultiPrice {
  const ready = ratesAvailable(rates);
  const values = {
    kzt: formatCurrency(tiyn, "KZT", rates),
    rub: formatCurrency(tiyn, "RUB", rates),
    byn: formatCurrency(tiyn, "BYN", rates),
  };
  // Без курса конвертация недоступна — показываем базовую цену в BYN.
  const mainKey: MainCurrency = ready ? main : "byn";
  const alt = ready
    ? (["byn", "kzt", "rub"] as const)
        .filter((c) => c !== mainKey)
        .map((c) => `≈ ${values[c]}`)
        .join(" · ")
    : "";
  return { ...values, main: values[mainKey], alt, ready };
}

/** Доступен ли кросс-курс BYN→KZT/RUB (rates.BYN и rates.RUB присутствуют). */
export function ratesAvailable(rates: RatesMap): boolean {
  return !!(rates.RUB && rates.BYN);
}
