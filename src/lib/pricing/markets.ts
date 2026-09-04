import type { CourseAudience } from "@prisma/client";
import { SITE_HOSTS } from "@/lib/seo/site-hosts";
import {
  bundlePriceTiyn,
  BASE_PRICE_TIYN,
  PRICE_MATRIX,
  SUBSCRIPTION_YEAR_TIYN,
} from "./index";

/**
 * Домен рынка берём из единого списка (мультидомен, D-013), а не строкой: домены
 * менялись (у России это sales-active.ru, а не activesales.ru), и справочник
 * тарифов не должен расходиться с тем, что реально отдаёт сервис.
 */
const hostFor = (code: string): string | null =>
  SITE_HOSTS.find((s) => s.code === code)?.host ?? null;

/** BYN-копейки → рубли: справочник оперирует целыми суммами. */
const toByn = (tiyn: number): number => Math.round(tiyn / 100);

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
  /** Домен рынка (docs/MULTI-DOMAIN-PLAN.md). null — рынка без своего домена. */
  domain: string | null;
  prices: Record<CourseAudience, MarketPrice>;
  /** Пакет «отраслевой + 2 общих», −17 % к сумме. */
  bundle: number;
  /** Годовая подписка на библиотеку. */
  subscriptionYear: number;
  /** Ориентир: с чем сравнивает покупатель на этом рынке. */
  benchmark: string;
}

/**
 * Цены рынков даны для СТАНДАРТНОЙ ступени объёма (1–3 часа видео). Экспресс и
 * расширенный отходят от неё так же, как в PRICE_MATRIX; отдельных исследований
 * по ступеням для России, Казахстана и Узбекистана нет.
 */
export const MARKETS: readonly Market[] = [
  {
    code: "BY",
    country: "Беларусь",
    currency: "бел. руб.",
    domain: hostFor("BY"),
    // Беларусь — базовый рынок: цифры выводятся из PRICE_MATRIX, а не дублируются.
    // Иначе правка матрицы разошлась бы с этой таблицей и заметили бы это нескоро.
    prices: {
      SPECIALIZED: {
        min: toByn(PRICE_MATRIX.SPECIALIZED.standard.min),
        max: toByn(PRICE_MATRIX.SPECIALIZED.standard.max),
        median: toByn(PRICE_MATRIX.SPECIALIZED.standard.price),
      },
      EVERYONE: {
        min: toByn(PRICE_MATRIX.EVERYONE.standard.min),
        max: toByn(PRICE_MATRIX.EVERYONE.standard.max),
        median: toByn(PRICE_MATRIX.EVERYONE.standard.price),
      },
    },
    bundle: toByn(
      bundlePriceTiyn([
        BASE_PRICE_TIYN.SPECIALIZED,
        BASE_PRICE_TIYN.EVERYONE,
        BASE_PRICE_TIYN.EVERYONE,
      ]),
    ),
    subscriptionYear: toByn(SUBSCRIPTION_YEAR_TIYN),
    benchmark:
      "Свой каталог без AI — 300–400 BYN; Skillbox-эквивалент «Тайм-менеджмент» — около 750 BYN",
  },
  {
    code: "RU",
    country: "Россия",
    currency: "рос. руб.",
    domain: hostFor("RU"),
    prices: {
      SPECIALIZED: { min: 11_900, max: 16_900, median: 13_900 },
      EVERYONE: { min: 6_900, max: 10_900, median: 8_900 },
    },
    bundle: 26_400,
    subscriptionYear: 34_900,
    benchmark:
      "Независимые видеокурсы 1 950–19 990 рос. руб.; Нетология «Передовые практики продаж» — 39 000 рос. руб.",
  },
  {
    code: "KZ",
    country: "Казахстан",
    currency: "тенге",
    domain: hostFor("KZ"),
    prices: {
      SPECIALIZED: { min: 69_900, max: 94_900, median: 79_900 },
      EVERYONE: { min: 39_900, max: 62_900, median: 49_900 },
    },
    bundle: 151_000,
    subscriptionYear: 199_000,
    benchmark:
      "МШП «Техники продаж» — 78 700 тенге; Skillbox.kz со скидкой — около 119 000 тенге",
  },
  {
    code: "UZ",
    country: "Узбекистан",
    currency: "сум",
    domain: hostFor("UZ"),
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
