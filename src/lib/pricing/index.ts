import type { AccessDuration, CourseAudience } from "@prisma/client";

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
 * Цену определяют две оси: КЛАСС курса и его ОБЪЁМ.
 *
 * Класс совпадает с осью витрины `Course.audience`: SPECIALIZED — отраслевой
 * курс (туризм, кухни, обувь, недвижимость, медпреды, B2B), EVERYONE — общая
 * тема (тайм-менеджмент, СПИН, переговоры). Отраслевые дороже: у́же аудитория,
 * выше готовность платить, меньше конкурентов.
 *
 * Объём — вторая ось, и вот почему она понадобилась: курсы различаются по
 * длительности в девять раз (39 минут у медпредов против 5 ч 51 м у кухонь).
 * Одна цена на такой разброс злит покупателя короткого курса — он видит
 * длительность прямо на странице и делает вывод сам.
 *
 * При этом цена НЕ пропорциональна часам: мы продаём результат, а не хронометраж,
 * иначе выгодно лить воду. К тому же AI-практика (наставник, тренажёры,
 * симулятор, карточки) собирается на любой курс независимо от его длины — эта
 * часть ценности от объёма не зависит вовсе. Отсюда ступени, а не коэффициент.
 */
export type VolumeKey = "express" | "standard" | "extended";

export interface VolumeTier {
  key: VolumeKey;
  label: string;
  hint: string;
  /** Верхняя граница суммарной длительности видео, секунды. */
  maxSeconds: number;
}

/** Порядок важен: ищем первую ступень, в которую укладывается длительность. */
export const VOLUME_TIERS: readonly VolumeTier[] = [
  { key: "express", label: "Экспресс", hint: "до 1 часа", maxSeconds: 3600 },
  { key: "standard", label: "Стандарт", hint: "1–3 часа", maxSeconds: 3 * 3600 },
  {
    key: "extended",
    label: "Расширенный",
    hint: "от 3 часов",
    maxSeconds: Number.POSITIVE_INFINITY,
  },
] as const;

export interface PriceBand {
  min: number;
  price: number;
  max: number;
}

/**
 * Матрица «класс × объём». Стандартная ступень совпадает с медианами тарифного
 * исследования (490 и 320), экспресс и расширенный отходят от них в пределах,
 * которые ещё читаются как та же продуктовая линейка.
 */
export const PRICE_MATRIX: Record<CourseAudience, Record<VolumeKey, PriceBand>> = {
  SPECIALIZED: {
    express: { min: byn(290), price: byn(350), max: byn(420) },
    standard: { min: byn(450), price: byn(490), max: byn(590) },
    extended: { min: byn(540), price: byn(590), max: byn(690) },
  },
  EVERYONE: {
    express: { min: byn(190), price: byn(250), max: byn(290) },
    standard: { min: byn(250), price: byn(320), max: byn(390) },
    extended: { min: byn(350), price: byn(390), max: byn(460) },
  },
};

/**
 * Ступень объёма по суммарной длительности видео. `null` (видео ещё не залито,
 * курс-каркас) считаем стандартом — это нейтральное предположение, которое
 * пересчитается само, когда фабрика зальёт уроки.
 */
export function volumeTier(totalSeconds: number | null): VolumeTier {
  if (totalSeconds === null || totalSeconds <= 0) return VOLUME_TIERS[1]!;
  return VOLUME_TIERS.find((t) => totalSeconds < t.maxSeconds) ?? VOLUME_TIERS[2]!;
}

/** Рекомендованная цена и коридор для конкретного курса. */
export function priceBand(
  audience: CourseAudience,
  totalSeconds: number | null,
): PriceBand & { tier: VolumeTier } {
  const tier = volumeTier(totalSeconds);
  return { ...PRICE_MATRIX[audience][tier.key], tier };
}

/**
 * Базовая цена класса (стандартный объём). Оставлена для мест, где длительность
 * курса недоступна, — например для витринных прикидок.
 */
export const BASE_PRICE_TIYN: Record<CourseAudience, number> = {
  SPECIALIZED: PRICE_MATRIX.SPECIALIZED.standard.price,
  EVERYONE: PRICE_MATRIX.EVERYONE.standard.price,
};

/** Коридор класса при стандартном объёме. */
export const PRICE_RANGE_TIYN: Record<CourseAudience, { min: number; max: number }> = {
  SPECIALIZED: {
    min: PRICE_MATRIX.SPECIALIZED.standard.min,
    max: PRICE_MATRIX.SPECIALIZED.standard.max,
  },
  EVERYONE: {
    min: PRICE_MATRIX.EVERYONE.standard.min,
    max: PRICE_MATRIX.EVERYONE.standard.max,
  },
};

/** Годовая подписка на библиотеку — ориентир 2,5–3 медианных отраслевых курса. */
export const SUBSCRIPTION_YEAR_TIYN = byn(1290);

/** Помесячная опция ≈ 1/10 годовой цены: снижает порог входа, но невыгодна на дистанции. */
export const SUBSCRIPTION_MONTH_TIYN = byn(129);

/** Скидка пакета «отраслевой + 2 общих» к сумме отдельных цен. */
export const BUNDLE_DISCOUNT = 0.17;

/**
 * Цена курса по умолчанию. `totalSeconds` — суммарная длительность видео
 * опубликованных уроков; без неё берётся стандартная ступень.
 */
export function defaultCoursePriceTiyn(
  audience: CourseAudience,
  totalSeconds: number | null = null,
): number {
  return priceBand(audience, totalSeconds).price;
}

/** Внутри ли цена рекомендованного коридора (для предупреждения в админке). */
export function isPriceWithinRange(
  audience: CourseAudience,
  priceTiyn: number,
  totalSeconds: number | null = null,
): boolean {
  const band = priceBand(audience, totalSeconds);
  return priceTiyn >= band.min && priceTiyn <= band.max;
}

/**
 * Как срок доступа называется покупателю. Отличается от админских подписей:
 * на витрине это обещание, а не настройка, поэтому «Бессрочно» превращается в
 * «Пожизненный доступ», а месяцы — в «Доступ N месяцев».
 */
export function accessDurationLabel(duration: AccessDuration): string {
  switch (duration) {
    case "LIFETIME":
      return "Пожизненный доступ";
    case "MONTHS_1":
      return "Доступ 1 месяц";
    case "MONTHS_3":
      return "Доступ 3 месяца";
    case "MONTHS_6":
      return "Доступ 6 месяцев";
    case "MONTHS_12":
      return "Доступ 1 год";
    case "MONTHS_24":
      return "Доступ 2 года";
    case "MONTHS_36":
      return "Доступ 3 года";
    default:
      return "Доступ по тарифу курса";
  }
}

/** «5 ч 51 м» / «39 мин» / «нет видео» — подпись объёма для интерфейса. */
export function formatDuration(totalSeconds: number | null): string {
  if (!totalSeconds || totalSeconds <= 0) return "нет видео";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);
  if (hours === 0) return `${minutes} мин`;
  return minutes === 0 ? `${hours} ч` : `${hours} ч ${minutes} мин`;
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

/**
 * Розничная база корпоративного набора — сумма цен выбранных курсов.
 *
 * Пакетная скидка `BUNDLE_DISCOUNT` здесь намеренно НЕ применяется: она живёт в
 * рознице, а корпоративная цена и так режется сеткой мест (до −35 %). Складывать
 * обе скидки — значит отдавать отдел за половину каталога.
 *
 * Библиотеки в B2B нет вовсе: курсы разнотематические (кухни, туризм, медпреды),
 * и отделу продаж одной компании релевантен ровно один отраслевой курс плюс
 * общие навыки — остальное в счёте выглядит навязанным.
 */
export function packRetailTiyn(pricesTiyn: number[]): number {
  return pricesTiyn.filter((p) => p > 0).reduce((sum, p) => sum + p, 0);
}

/**
 * Самый дешёвый корпоративный набор — база для «от N за сотрудника» на витрине:
 * недорогой отраслевой курс плюс все общие. Считается из каталога, поэтому
 * обещание в первом экране совпадает с тем, что человек увидит в калькуляторе.
 *
 * Пустой каталог (пререндер без БД) даёт нейтральную оценку по базовым ценам.
 */
export function entryPackTiyn(
  courses: readonly { priceTiyn: number; audience: CourseAudience }[],
): number {
  const generalSum = packRetailTiyn(
    courses.filter((c) => c.audience === "EVERYONE").map((c) => c.priceTiyn),
  );
  const industryPrices = courses
    .filter((c) => c.audience === "SPECIALIZED")
    .map((c) => c.priceTiyn)
    .filter((p) => p > 0);

  if (industryPrices.length > 0) return Math.min(...industryPrices) + generalSum;
  return generalSum || BASE_PRICE_TIYN.SPECIALIZED + BASE_PRICE_TIYN.EVERYONE;
}

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

// Акция витрины живёт отдельным модулем, но импортируется отсюда же: у цен
// платформы должна быть одна точка входа, иначе половина кода посчитает скидку,
// а половина — нет.
export * from "./promo";
