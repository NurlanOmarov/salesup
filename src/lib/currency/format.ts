import { salePrice } from "@/lib/pricing/promo";
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

export type CurrencyCode = "KZT" | "RUB" | "BYN" | "UZS";

/** Валюты, показываемые на витрине: белорусский рубль (основная), тенге, российский рубль. */
export const DISPLAY_CURRENCIES: CurrencyCode[] = ["BYN", "KZT", "RUB", "UZS"];

/**
 * Валюты подписываем словами, а не значками: «350 бел. руб.» читается
 * однозначно, а «350 Br» и «₸/₽» покупатель на чужом домене принимает за свою
 * валюту (решение владельца, 2026-09-04).
 */
// Внутри подписи тоже неразрывный пробел: «рос. руб.» не должно разрываться
// переносом строки посреди названия валюты.
const SYMBOLS: Record<CurrencyCode, string> = {
  KZT: "тенге",
  RUB: "рос.\u00A0руб.",
  BYN: "бел.\u00A0руб.",
  UZS: "сум",
};

/**
 * Названия валют на языке витрины: словесную подпись переводим, иначе на
 * казахской и узбекской странице цена подписана по-русски. Пусто → SYMBOLS.
 */
const SYMBOLS_BY_LOCALE: Record<string, Partial<Record<CurrencyCode, string>>> = {
  kk: { KZT: "теңге", RUB: "рес.\u00A0рубль", BYN: "бел.\u00A0рубль", UZS: "сом" },
  uz: { KZT: "tenge", RUB: "Rossiya\u00A0rubli", BYN: "Belarus\u00A0rubli", UZS: "so'm" },
};

/** Обозначение валюты для языка страницы. */
export function currencySymbol(code: CurrencyCode, locale?: string): string {
  return (locale && SYMBOLS_BY_LOCALE[locale]?.[code]) || SYMBOLS[code];
}

/**
 * Округление конвертируемой суммы (ceil до «красивого» шага).
 * Повторяет transfer-astana booking_service._round_currency.
 */
function roundForCurrency(amount: number, code: CurrencyCode): number {
  if (code === "KZT" || code === "RUB") return Math.ceil(amount / 100) * 100;
  // Сумы: цены шестизначные, округление до сотни выглядит фальшивой точностью.
  if (code === "UZS") return Math.ceil(amount / 1000) * 1000;
  return amount; // BYN — базовая цена, без округления
}

/** tiyn (Int, BYN-копейки) → major units (бел. руб./тенге/рос. руб.) по курсу. 0 если курс недоступен. */
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

/** Готовая строка цены в валюте, напр. «7 600 рос. руб.». «—» при отсутствии курса. */
export function formatCurrency(
  tiyn: number,
  code: CurrencyCode,
  rates: RatesMap,
  /** Язык витрины: от него зависит словесное обозначение валюты. */
  locale?: string,
): string {
  const amount = convertTiyn(tiyn, code, rates);
  if (amount <= 0) return "—";
  // Неразрывный пробел перед подписью: с обычным «147 800 тенге» название
  // валюты переносится на следующую строку, и цифра выглядит оборванной.
  return (
    Math.round(amount).toLocaleString("ru-RU", { maximumFractionDigits: 0 }) +
    "\u00A0" +
    currencySymbol(code, locale)
  );
}

export interface MultiPrice {
  kzt: string;
  rub: string;
  byn: string;
  uzs: string;
  /** Цена в валюте страны домена — её посетитель видит крупно. */
  main: string;
  /**
   * Раньше — строка с остальными валютами. Сейчас всегда пусто: витрина каждой
   * страны показывает только свою валюту. Поле осталось, чтобы не переписывать
   * потребителей; они уже проверяют его на пустоту.
   */
  alt: string;
  /** false, если кросс-курс ещё не загружен (тогда KZT/RUB = «—»). */
  ready: boolean;
}

/** Валюта витрины по домену (мультидомен): ключ поля MultiPrice. */
export type MainCurrency = "byn" | "kzt" | "rub" | "uzs";

/**
 * Три валюты разом — для карточек и блоков цены. main — валюта страны домена:
 * казахстанскому посетителю цена показывается в тенге, российскому в рублях,
 * остальные остаются справочными (цена договора — BYN, см. оферту).
 */
export function buildMultiPrice(
  tiyn: number,
  rates: RatesMap,
  main: MainCurrency = "byn",
  locale?: string,
): MultiPrice {
  const ready = ratesAvailable(rates);
  const values = {
    kzt: formatCurrency(tiyn, "KZT", rates, locale),
    rub: formatCurrency(tiyn, "RUB", rates, locale),
    byn: formatCurrency(tiyn, "BYN", rates, locale),
    uzs: formatCurrency(tiyn, "UZS", rates, locale),
  };
  // Без курса конвертация недоступна — показываем базовую цену в BYN.
  const mainKey: MainCurrency = ready ? main : "byn";
  // Решение владельца: витрина показывает только валюту своей страны. Раньше
  // рядом шла строка «≈» с остальными курсами — на четырёх рынках она стала
  // шумом и не помещалась в карточку. Цена договора (BYN) и оговорка о
  // справочном эквиваленте остаются в оферте (src/content/legal).
  const alt = "";
  return { ...values, main: values[mainKey], alt, ready };
}

/** Доступен ли кросс-курс BYN→KZT/RUB (rates.BYN и rates.RUB присутствуют). */
export function ratesAvailable(rates: RatesMap): boolean {
  return !!(rates.RUB && rates.BYN);
}

export interface DisplayPrice extends MultiPrice {
  /** Зачёркнутая цена в валюте витрины. null — акции нет. */
  old: string | null;
  /** Размер скидки, % (0 вне акции) — для бейджа «−50 %». */
  percent: number;
}

/**
 * Цена для витрины с учётом акции (lib/pricing/promo): `main` — то, что платит
 * покупатель, `old` — зачёркнутая полная цена в той же валюте.
 *
 * Именно здесь, а не в БД: в базе лежит полный прайс, и когда акция кончится,
 * витрина вернётся к нему сама, без миграции и без риска потерять исходные цены.
 */
export function buildDisplayPrice(
  fullTiyn: number,
  rates: RatesMap,
  main: MainCurrency = "byn",
  locale?: string,
): DisplayPrice {
  const sale = salePrice(fullTiyn);
  const prices = buildMultiPrice(sale.tiyn, rates, main, locale);
  const old = sale.oldTiyn ? buildMultiPrice(sale.oldTiyn, rates, main, locale).main : null;
  return { ...prices, old, percent: sale.percent };
}

/**
 * Запасной курс доллара к BYN, если фид Нацбанка ещё не подгрузился: цена
 * тренерского пакета не должна превращаться в «—» на холодном старте контейнера.
 * Соответствует справочнику рынков (lib/pricing/markets: 1 Br ≈ 0,345 $).
 */
const FALLBACK_USD_BYN = 1 / 0.345;

/**
 * Доллары → BYN-копейки. Курсы НБ РК заданы в тенге за единицу валюты, поэтому
 * идём через кросс-курс USD → KZT → BYN — тем же путём, что и витрина цен.
 */
export function usdToTiyn(usd: number, rates: RatesMap): number {
  const usdKzt = rates.USD;
  const bynKzt = rates.BYN;
  if (!usdKzt || !bynKzt || bynKzt <= 0) {
    return Math.round(usd * FALLBACK_USD_BYN * 100);
  }
  return Math.round(((usd * usdKzt) / bynKzt) * 100);
}
