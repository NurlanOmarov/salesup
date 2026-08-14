import type { CourseAudience } from "@prisma/client";

/**
 * Ценообразование платформы (docs/PRICING-PLAN.md, редакция 2 от 2026-08-14).
 *
 * Базовая валюта — BYN; цены хранятся в BYN-копейках (`Course.priceTiyn`,
 * историческое имя поля, см. D-010). Здесь — источник истины для дефолтных цен,
 * пакетов, подписки и корпоративной сетки скидок: и админка, и B2B-калькулятор,
 * и витрина считают по одним и тем же числам.
 *
 * Всё в этом файле — чистые функции без БД, покрыты тестами (pricing.test.ts).
 */

/** 1 Br = 100 tiyn. */
export const TIYN_PER_BYN = 100;

export const byn = (amount: number): number => Math.round(amount * TIYN_PER_BYN);

/**
 * Класс курса определяет цену. Совпадает с осью витрины `Course.audience`:
 * SPECIALIZED — отраслевой курс (туризм, кухни, обувь, недвижимость, медпреды,
 * B2B), EVERYONE — общая тема (тайм-менеджмент, СПИН, переговоры).
 *
 * Отраслевые дороже: у́же аудитория, выше готовность платить, меньше конкурентов.
 * Общие темы держим на уровне legacy-видео — сегмент насыщеннее.
 */
export const BASE_PRICE_TIYN: Record<CourseAudience, number> = {
  SPECIALIZED: byn(490),
  EVERYONE: byn(320),
};

/** Допустимый коридор цены по классу — подсказка админу, а не жёсткий запрет. */
export const PRICE_RANGE_TIYN: Record<CourseAudience, { min: number; max: number }> = {
  SPECIALIZED: { min: byn(450), max: byn(590) },
  EVERYONE: { min: byn(250), max: byn(390) },
};

/** Годовая подписка на библиотеку — ориентир 2,5–3 медианных отраслевых курса. */
export const SUBSCRIPTION_YEAR_TIYN = byn(1290);

/** Помесячная опция ≈ 1/10 годовой цены: снижает порог входа, но невыгодна на дистанции. */
export const SUBSCRIPTION_MONTH_TIYN = byn(129);

/** Скидка пакета «отраслевой + 2 общих» к сумме отдельных цен. */
export const BUNDLE_DISCOUNT = 0.17;

/** Цена курса по умолчанию для его класса. */
export function defaultCoursePriceTiyn(audience: CourseAudience): number {
  return BASE_PRICE_TIYN[audience];
}

/** Внутри ли цена рекомендованного коридора (для предупреждения в админке). */
export function isPriceWithinRange(
  audience: CourseAudience,
  priceTiyn: number,
): boolean {
  const range = PRICE_RANGE_TIYN[audience];
  return priceTiyn >= range.min && priceTiyn <= range.max;
}

/** Цена пакета из нескольких курсов: сумма минус скидка, округление до 10 BYN вниз. */
export function bundlePriceTiyn(pricesTiyn: number[]): number {
  const sum = pricesTiyn.reduce((s, p) => s + p, 0);
  const discounted = sum * (1 - BUNDLE_DISCOUNT);
  return Math.floor(discounted / byn(10)) * byn(10);
}

// ─────────────────────────── B2B: сетка мест ───────────────────────────

/**
 * Корпоративная сетка скидок по числу мест (PRICING-PLAN §8).
 *
 * Осознанно консервативна: у компании есть живой канал офлайн-тренингов с чеком
 * в сотни тысяч тенге за группу, и дешёвый онлайн-доступ не должен его подрезать.
 * Порядок важен — ищем первый подходящий порог сверху вниз.
 */
export interface SeatTier {
  /** Минимальное число мест для попадания в уровень. */
  minSeats: number;
  discount: number;
  label: string;
}

export const SEAT_TIERS: readonly SeatTier[] = [
  { minSeats: 20, discount: 0.35, label: "Компания" },
  { minSeats: 10, discount: 0.25, label: "Отдел" },
  { minSeats: 5, discount: 0.15, label: "Команда" },
] as const;

/** Минимальный корпоративный пакет: ниже сделка не окупает переговоры. */
export const MIN_B2B_SEATS = 5;

/** Уровень сетки для числа мест (null — меньше минимального пакета). */
export function seatTier(seats: number): SeatTier | null {
  return SEAT_TIERS.find((t) => seats >= t.minSeats) ?? null;
}

export interface SeatQuote {
  seats: number;
  tier: SeatTier | null;
  /** Цена одного места с учётом скидки, BYN-копейки. */
  pricePerSeatTiyn: number;
  /** Итог за все места. */
  totalTiyn: number;
  /** Скидка к розничной цене, 0..1. */
  discount: number;
  /** Экономия против покупки в розницу. */
  savingTiyn: number;
}

/**
 * Расчёт корпоративного предложения: цена места и годовой чек.
 *
 * @param retailTiyn розничная цена того, что покупают: конкретного курса
 *                   (`Course.priceTiyn`) или годовой подписки на библиотеку
 *                   (`SUBSCRIPTION_YEAR_TIYN`).
 */
export function quoteSeats(seats: number, retailTiyn: number): SeatQuote {
  const tier = seatTier(seats);
  const discount = tier?.discount ?? 0;
  // Округляем цену места до 10 BYN — так в КП нет «412,25 Br».
  const pricePerSeatTiyn =
    Math.round((retailTiyn * (1 - discount)) / byn(10)) * byn(10);
  const totalTiyn = pricePerSeatTiyn * seats;

  return {
    seats,
    tier,
    pricePerSeatTiyn,
    totalTiyn,
    discount,
    savingTiyn: retailTiyn * seats - totalTiyn,
  };
}
