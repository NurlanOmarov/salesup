/**
 * Раскладка одного поступления денег (docs/DECISIONS.md D-018):
 *
 *   получено − налоги и сборы = чистая прибыль;
 *   каждый совладелец — свой процент от чистой;
 *   автор курса — всё, что осталось.
 *
 * Пример (Казахстан, ставка 11,364%): 44 000 − 5 000 = 39 000;
 * Н. 20% = 7 800; В. = 31 200.
 *
 * Суммы — в минорных единицах (1 тенге = 100). Налог и доли округляются до целых
 * тенге/рублей/сумов: так их и выплачивают. Белорусский рубль — до копейки, иначе
 * погрешность в полрубля на каждой выплате заметна. Автору идёт остаток, поэтому
 * сумма выплат всегда ровно равна чистой прибыли — копейки не теряются.
 */

export const COUNTRIES = ["KZ", "BY", "RU", "UZ"] as const;
export type Country = (typeof COUNTRIES)[number];

export const COUNTRY_LABELS: Record<Country, string> = {
  KZ: "Казахстан",
  BY: "Беларусь",
  RU: "Россия",
  UZ: "Узбекистан",
};

export const INCOME_CURRENCIES = ["KZT", "BYN", "RUB", "UZS"] as const;
export type IncomeCurrency = (typeof INCOME_CURRENCIES)[number];

/** Валюта, в которой обычно платит покупатель из этой страны. */
export const COUNTRY_CURRENCY: Record<Country, IncomeCurrency> = {
  KZ: "KZT",
  BY: "BYN",
  RU: "RUB",
  UZ: "UZS",
};

/** Шаг округления в минорных единицах. */
function unitStep(currency: string): number {
  return currency === "BYN" ? 1 : 100;
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** Налог по ставке: rateMilli — процент × 1000 (11364 = 11,364%). */
export function taxByRate(grossTiyn: number, rateMilli: number, currency: string): number {
  return roundTo((grossTiyn * rateMilli) / 100_000, unitStep(currency));
}

export interface SplitPayee {
  id: string;
  role: "CO_OWNER" | "AUTHOR";
  /** Доля совладельца от чистой, сотые процента (2000 = 20%). */
  shareBp: number | null;
}

export interface SplitLine {
  payeeId: string;
  shareBp: number;
  amountTiyn: number;
}

export interface SplitResult {
  taxTiyn: number;
  netTiyn: number;
  shares: SplitLine[];
}

/**
 * @param taxTiyn — фактический налог, если владелец поправил расчётный; иначе
 *   считается по ставке.
 */
export function splitIncome(params: {
  grossTiyn: number;
  rateMilli: number;
  currency: string;
  coOwners: SplitPayee[];
  author: SplitPayee;
  taxTiyn?: number | null;
}): SplitResult {
  const { grossTiyn, rateMilli, currency, coOwners, author } = params;
  if (!Number.isInteger(grossTiyn) || grossTiyn <= 0) {
    throw new Error("Сумма поступления должна быть больше нуля");
  }

  const taxTiyn = params.taxTiyn ?? taxByRate(grossTiyn, rateMilli, currency);
  if (taxTiyn < 0 || taxTiyn > grossTiyn) {
    throw new Error("Налог не может быть больше полученной суммы");
  }
  const netTiyn = grossTiyn - taxTiyn;

  const totalBp = coOwners.reduce((s, p) => s + (p.shareBp ?? 0), 0);
  if (totalBp > 10_000) {
    throw new Error("Доли совладельцев в сумме больше 100%");
  }

  const step = unitStep(currency);
  const shares: SplitLine[] = coOwners.map((p) => ({
    payeeId: p.id,
    shareBp: p.shareBp ?? 0,
    amountTiyn: roundTo((netTiyn * (p.shareBp ?? 0)) / 10_000, step),
  }));
  const paid = shares.reduce((s, l) => s + l.amountTiyn, 0);
  shares.push({
    payeeId: author.id,
    shareBp: 10_000 - totalBp,
    amountTiyn: netTiyn - paid,
  });

  return { taxTiyn, netTiyn, shares };
}

/**
 * Доход получателя — его доля выручки до налогов: налоги ложатся на каждого
 * пропорционально доле. Н. получил 7 800 из чистых 39 000 при выручке 44 000 →
 * доход 8 800, из них налоги 1 000.
 */
export function payeeGross(shareTiyn: number, netTiyn: number, grossTiyn: number): number {
  return netTiyn > 0 ? Math.round((shareTiyn * grossTiyn) / netTiyn) : 0;
}

/** «11,364%» из rateMilli. */
export function formatRate(rateMilli: number): string {
  return `${(rateMilli / 1000).toLocaleString("ru-RU", { maximumFractionDigits: 3 })}%`;
}

/** «20%» из сотых процента. */
export function formatBp(bp: number): string {
  return `${(bp / 100).toLocaleString("ru-RU", { maximumFractionDigits: 2 })}%`;
}

const CURRENCY_WORDS: Record<string, string> = {
  KZT: "тенге",
  BYN: "бел. руб.",
  RUB: "рос. руб.",
  UZS: "сум",
};

/** «44 000 тенге» из минорных единиц. */
export function formatMoney(tiyn: number, currency: string): string {
  const major = tiyn / 100;
  const text = major.toLocaleString("ru-RU", {
    minimumFractionDigits: Number.isInteger(major) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${text} ${CURRENCY_WORDS[currency] ?? currency}`;
}
