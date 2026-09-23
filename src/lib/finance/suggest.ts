import { quoteSeats } from "@/lib/pricing";
import { saleTiyn } from "@/lib/pricing/promo";
import { convertTiyn, type CurrencyCode } from "@/lib/currency/format";
import type { RatesMap } from "@/lib/currency/rates";
import { pluralRu } from "@/lib/courses/plural";
import {
  COUNTRIES,
  COUNTRY_CURRENCY,
  formatMoney,
  type Country,
  type IncomeCurrency,
} from "./split";

/**
 * Предзаполнение записи поступления от организации.
 *
 * Зачем: доступы клиенту выдаются раньше, чем деньги попадают в учёт, — владелец
 * отмечает организацию платной и идёт дальше, а поступление вносить забывает.
 * Тогда в /admin/finance этих денег нет вовсе. Чтобы заполнение сводилось к
 * проверке, сумма считается из того, что уже известно по лицензиям клиента:
 * места × цена места по счёту, а где цена не записана — по корпоративной сетке
 * (docs/PRICING-PLAN.md §8).
 *
 * Валюта — валюта страны клиента: платит он в своей. База цен — BYN (D-010),
 * поэтому сумма пересчитывается по курсу НБ РК тем же кодом, что и витрина, —
 * иначе предложенная цифра расходилась бы с той, которую клиент видел.
 *
 * Это ПОДСКАЗКА, а не расчёт чека: записывается всегда то, что реально пришло,
 * поэтому все поля формы остаются редактируемыми.
 */

export interface SuggestLicense {
  courseId: string;
  seatsTotal: number;
  /** Цена места по счёту, BYN-копейки. null — в лицензии не записана. */
  priceTiyn: number | null;
  /** Розничная цена курса, BYN-копейки — запасной расчёт по сетке. */
  coursePriceTiyn: number;
  note: string | null;
}

export interface IncomeSuggestion {
  country: Country;
  currency: IncomeCurrency;
  /** Сумма в минорных единицах валюты поступления; null — считать не из чего. */
  grossTiyn: number | null;
  /** Та же сумма в BYN-копейках, до пересчёта. */
  bynTiyn: number;
  /** Курс проставляется только при одной лицензии — иначе «несколько». */
  courseId: string | null;
  note: string | null;
  seats: number;
  licenses: number;
  /** Цена хотя бы одной лицензии не записана — сумма посчитана по сетке. */
  estimated: boolean;
  /** Сумма пересчитана из BYN по курсу НБ РК. */
  converted: boolean;
  /** Курса НБ РК нет в кэше — пересчитать не удалось. */
  ratesMissing: boolean;
  /** «10 мест × 441 бел. руб. = 4 410 бел. руб.» — из чего сложилась сумма. */
  basis: string;
  /**
   * Сколько поступлений от клиента уже записано. Больше нуля — предупреждение:
   * предложенная сумма относится к тем же лицензиям, за которые уже платили.
   */
  existingIncomes: number;
}

function isCountry(v: string | null | undefined): v is Country {
  return (COUNTRIES as readonly string[]).includes(v ?? "");
}

/** Цена места, если в лицензии её не записали: корпоративная сетка + акция. */
function fallbackPerSeat(license: SuggestLicense, now: Date): number {
  if (license.coursePriceTiyn <= 0) return 0;
  return saleTiyn(
    quoteSeats(license.seatsTotal, license.coursePriceTiyn).pricePerSeatTiyn,
    now,
  );
}

export function buildIncomeSuggestion(input: {
  /** Рынок клиента (Organization.site): от него валюта и ставка налога. */
  site: string | null;
  licenses: SuggestLicense[];
  rates: RatesMap;
  /** Уже записанные поступления от этого клиента. */
  existingIncomes?: number;
  now?: Date;
}): IncomeSuggestion {
  const now = input.now ?? new Date();
  // Страна не указана — оставляем ту же страну по умолчанию, что и пустая форма.
  const country: Country = isCountry(input.site) ? input.site : "KZ";
  const currency = COUNTRY_CURRENCY[country];

  const licenses = input.licenses.filter((l) => l.seatsTotal > 0);
  let bynTiyn = 0;
  let seats = 0;
  let estimated = false;
  let perSeatSingle = 0;
  for (const l of licenses) {
    const perSeat = l.priceTiyn ?? fallbackPerSeat(l, now);
    if (l.priceTiyn == null) estimated = true;
    bynTiyn += perSeat * l.seatsTotal;
    seats += l.seatsTotal;
    perSeatSingle = perSeat;
  }

  // Пересчёт тем же кодом, что и витрина: convertTiyn округляет «по-красивому»
  // (тенге и рубли — до сотни вверх, сумы — до тысячи).
  let grossTiyn: number | null = null;
  let ratesMissing = false;
  if (bynTiyn > 0) {
    if (currency === "BYN") {
      grossTiyn = bynTiyn;
    } else {
      const major = convertTiyn(bynTiyn, currency as CurrencyCode, input.rates);
      if (major > 0) grossTiyn = Math.round(major) * 100;
      else ratesMissing = true;
    }
  }

  const note = licenses.map((l) => l.note?.trim()).find((n) => n) ?? null;
  const seatsWord = pluralRu(seats, "место", "места", "мест");

  const basis =
    bynTiyn <= 0
      ? licenses.length === 0
        ? "лицензий нет — сумму придётся ввести руками"
        : "цена мест не записана — сумму придётся ввести руками"
      : licenses.length === 1
        ? `${seats} ${seatsWord} × ${formatMoney(perSeatSingle, "BYN")} = ${formatMoney(bynTiyn, "BYN")}`
        : `${licenses.length} ${pluralRu(licenses.length, "лицензия", "лицензии", "лицензий")}, ` +
          `${seats} ${seatsWord} = ${formatMoney(bynTiyn, "BYN")}`;

  return {
    country,
    currency,
    grossTiyn,
    bynTiyn,
    courseId: licenses.length === 1 ? (licenses[0]?.courseId ?? null) : null,
    note: note ? note.slice(0, 500) : null,
    seats,
    licenses: licenses.length,
    estimated,
    converted: currency !== "BYN",
    ratesMissing,
    basis,
    existingIncomes: input.existingIncomes ?? 0,
  };
}
