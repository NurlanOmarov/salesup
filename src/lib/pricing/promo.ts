/**
 * Акция «−50 %»: единственное место, где живёт скидка витрины.
 *
 * Правило по всему коду: в БД, в пропсах и в расчётах ходит ПОЛНАЯ цена
 * (`Course.priceTiyn`), а скидка применяется в момент показа или подсчёта чека
 * через `salePrice`/`saleTiyn`. Так акцию можно выключить одной датой, не
 * трогая ни одну строку в базе и не рискуя потерять исходный прайс.
 *
 * Почему у акции есть дата окончания, а не «навсегда»: зачёркнутая цена — это
 * утверждение, что раньше продавали дороже. Бессрочная «скидка» перестаёт
 * работать на конверсию (её видят как обычный прайс) и попадает под признаки
 * недостоверной рекламы (РБ — МАРТ, РФ — ФАС ст. 5 38-ФЗ). После `endsAt`
 * витрина сама возвращается к полным ценам — руками ничего делать не нужно.
 */

export const PROMO = {
  /** Рубильник на случай, если акцию нужно снять раньше срока. */
  enabled: true,
  /** Размер скидки, %. */
  percent: 50,
  /** Начало акции (Минск, +03:00). */
  startsAt: "2026-08-21T00:00:00+03:00",
  /** Конец акции включительно. Меняется здесь и больше нигде. */
  endsAt: "2026-09-30T23:59:59+03:00",
} as const;

/** Идёт ли акция прямо сейчас. */
export function promoActive(now: Date = new Date()): boolean {
  if (!PROMO.enabled) return false;
  const time = now.getTime();
  return time >= Date.parse(PROMO.startsAt) && time <= Date.parse(PROMO.endsAt);
}

/** Момент окончания акции — для таймера и для `priceValidUntil` в разметке. */
export function promoEndsAt(): Date {
  return new Date(Date.parse(PROMO.endsAt));
}

export interface SalePrice {
  /** Цена к оплате: со скидкой, если акция идёт. */
  tiyn: number;
  /** Что зачёркиваем. null — акции нет, зачёркивать нечего. */
  oldTiyn: number | null;
  /** Размер скидки, % (0 вне акции). */
  percent: number;
}

/**
 * Полная цена → пара «старая/новая».
 *
 * Округляем до целого рубля: половина от 590 Br — это 295 Br, а не 295,00, и
 * дробные копейки в конвертации в тенге/сум дают лишний разряд мусора.
 */
export function salePrice(fullTiyn: number, now: Date = new Date()): SalePrice {
  if (!promoActive(now) || fullTiyn <= 0) {
    return { tiyn: fullTiyn, oldTiyn: null, percent: 0 };
  }
  const discounted = Math.round((fullTiyn * (100 - PROMO.percent)) / 100 / 100) * 100;
  return { tiyn: discounted, oldTiyn: fullTiyn, percent: PROMO.percent };
}

/** Короткая форма, когда старая цена не нужна (расчёты, суммы в заявке). */
export function saleTiyn(fullTiyn: number, now: Date = new Date()): number {
  return salePrice(fullTiyn, now).tiyn;
}

/** Дата окончания акции словами: «30 сентября» — для баннера и подписей. */
export function promoEndsLabel(locale: "ru" | "kk" | "uz" = "ru"): string {
  const map = { ru: "ru-RU", kk: "kk-KZ", uz: "uz-UZ" } as const;
  return promoEndsAt().toLocaleDateString(map[locale], {
    day: "numeric",
    month: "long",
    timeZone: "Europe/Minsk",
  });
}
