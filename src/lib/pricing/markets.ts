import type { CourseAudience } from "@prisma/client";

/**
 * Справочные цены по рынкам присутствия (docs/PRICING-PLAN.md, редакция 2).
 *
 * ВАЖНО, чем это НЕ является: витрина считает цены конвертацией из BYN по курсу
 * (D-010), а здесь — рекомендованные значения из тарифного исследования, на
 * которые опирается владелец при назначении цены новому курсу и при переговорах.
 * Пока цены по рынкам не заданы отдельным полем (PRICING-PLAN §11, п. 1), это
 * справочник для человека, а не источник для расчёта чека покупателю.
 *
 * Курсы валют зафиксированы на середину августа 2026 и подлежат пересмотру
 * ежеквартально — поэтому дата указана рядом и видна в интерфейсе.
 */

export const RATES_AS_OF = "август 2026";

/** Сколько единиц валюты в одном белорусском рубле (для пересчёта справочно). */
export const PER_BYN = {
  RUB: 28.4,
  KZT: 162,
  UZS: 4105,
  USD: 0.345,
} as const;

export interface MarketPrice {
  /** Рекомендованный коридор в местной валюте. */
  min: number;
  max: number;
  /** Медиана-«якорь»: с неё начинают. */
  median: number;
}

export interface Market {
  code: "BY" | "RU" | "KZ" | "UZ";
  country: string;
  currency: string;
  /** Домен рынка (docs/MULTI-DOMAIN-PLAN.md). Для Узбекистана домена пока нет. */
  domain: string | null;
  prices: Record<CourseAudience, MarketPrice>;
  /** Пакет «отраслевой + 2 общих», −17 % к сумме. */
  bundle: number;
  /** Годовая подписка на библиотеку. */
  subscriptionYear: number;
  /** Ориентир: с чем сравнивает покупатель на этом рынке. */
  benchmark: string;
}

export const MARKETS: readonly Market[] = [
  {
    code: "BY",
    country: "Беларусь",
    currency: "BYN",
    domain: "study.activesales.by",
    prices: {
      SPECIALIZED: { min: 450, max: 590, median: 490 },
      EVERYONE: { min: 250, max: 390, median: 320 },
    },
    bundle: 930,
    subscriptionYear: 1290,
    benchmark:
      "Свой каталог без AI — 300–400 BYN; Skillbox-эквивалент «Тайм-менеджмент» — около 750 BYN",
  },
  {
    code: "RU",
    country: "Россия",
    currency: "₽",
    domain: "study.activesales.ru",
    prices: {
      SPECIALIZED: { min: 11_900, max: 16_900, median: 13_900 },
      EVERYONE: { min: 6_900, max: 10_900, median: 8_900 },
    },
    bundle: 26_400,
    subscriptionYear: 34_900,
    benchmark:
      "Независимые видеокурсы 1 950–19 990 ₽; Нетология «Передовые практики продаж» — 39 000 ₽",
  },
  {
    code: "KZ",
    country: "Казахстан",
    currency: "₸",
    domain: "study.activesales.kz",
    prices: {
      SPECIALIZED: { min: 69_900, max: 94_900, median: 79_900 },
      EVERYONE: { min: 39_900, max: 62_900, median: 49_900 },
    },
    bundle: 151_000,
    subscriptionYear: 199_000,
    benchmark:
      "МШП «Техники продаж» — 78 700 ₸; Skillbox.kz со скидкой — около 119 000 ₸",
  },
  {
    code: "UZ",
    country: "Узбекистан",
    currency: "сум",
    domain: null,
    prices: {
      SPECIALIZED: { min: 1_790_000, max: 2_390_000, median: 1_990_000 },
      EVERYONE: { min: 990_000, max: 1_590_000, median: 1_290_000 },
    },
    bundle: 3_820_000,
    subscriptionYear: 4_990_000,
    benchmark:
      "Swipe «B2B-продажи» — 2 656 943 сум; курсы про маркетплейсы Uzum — 1 190 000 сум",
  },
] as const;

export const AUDIENCE_TITLE: Record<CourseAudience, string> = {
  SPECIALIZED: "Отраслевой курс",
  EVERYONE: "Общая тема",
};

export const AUDIENCE_EXAMPLES: Record<CourseAudience, string> = {
  SPECIALIZED: "туризм, мебель и кухни, обувь, недвижимость, медпредставители, B2B",
  EVERYONE: "тайм-менеджмент, СПИН-продажи, техника переговоров",
};

/** Формат числа с разделителями: 1 290 вместо 1290. */
export function formatAmount(value: number): string {
  return value.toLocaleString("ru-RU");
}
