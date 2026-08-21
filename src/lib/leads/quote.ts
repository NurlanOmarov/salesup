import { MIN_B2B_SEATS, packRetailTiyn, quoteSeats } from "@/lib/pricing";
import { salePrice } from "@/lib/pricing/promo";

/**
 * Что человек выбрал перед отправкой заявки и сколько это стоит.
 *
 * Считаем на сервере по тем же правилам, что и калькулятор на витрине
 * (components/landing/seats-calculator): клиент присылает только выбор — курсы
 * и число мест, — а цену выводим сами. Иначе в заявке оказалась бы сумма,
 * которую можно подделать в браузере, и она разошлась бы со счётом.
 */

/**
 * `LIBRARY` больше не выдаётся: корпоративный доступ ко всей библиотеке снят с
 * витрины (курсы разнотематические, отделу нужен свой набор). Ключ остаётся в
 * типе и в enum БД ради заявок, поданных до этого решения, — админка обязана их
 * читать.
 */
export type LeadPlanKey = "COURSE" | "LIBRARY" | "COURSES";

/** Тариф, который может назначить сегодняшняя витрина. */
export type ActiveLeadPlanKey = Exclude<LeadPlanKey, "LIBRARY">;

/** Подписи тарифов — одни и те же в уведомлении и в админке. */
export const PLAN_LABELS: Record<LeadPlanKey, string> = {
  COURSE: "курс",
  LIBRARY: "вся библиотека на год",
  COURSES: "выбранные курсы",
};

/**
 * Строка тарифа из сохранённых в заявке полей — для /admin/leads, где считать
 * заново нечего: цена зафиксирована в момент подачи и с тех пор могла измениться.
 */
export function describeStoredPlan(input: {
  plan: LeadPlanKey | null;
  seats: number | null;
  perSeatTiyn: number | null;
  totalTiyn: number | null;
  /** Заявка с живыми сессиями тренера: надбавка уже внутри totalTiyn. */
  withTrainer?: boolean;
}): string | null {
  if (!input.plan) return null;
  const br = (tiyn: number) => `${(tiyn / 100).toLocaleString("ru-RU")} Br`;
  const label = PLAN_LABELS[input.plan];
  const trainer = input.withTrainer ? " + пакет с тренером" : "";

  if (input.plan === "COURSE") {
    return input.totalTiyn ? `Тариф: ${label}, ${br(input.totalTiyn)}` : `Тариф: ${label}`;
  }
  if (!input.perSeatTiyn || !input.totalTiyn || !input.seats) return `Тариф: ${label}${trainer}`;
  return `Тариф: ${label}${trainer} — ${br(input.perSeatTiyn)} × ${input.seats} = ${br(input.totalTiyn)}`;
}

export interface LeadQuote {
  plan: ActiveLeadPlanKey;
  /** Число мест (B2B); null для розницы. */
  seats: number | null;
  /** Розничная база: цена курса (B2C) или сумма выбранных курсов (B2B). */
  retailTiyn: number;
  /** Только B2B: цена места со скидкой. */
  perSeatTiyn: number | null;
  totalTiyn: number;
  /** Скидка сетки, 0..1 (B2C — 0). */
  discount: number;
  /** «Отдел», «Компания» — уровень корпоративной сетки; null, если не дотянули. */
  tierLabel: string | null;
  /** Мест меньше минимального корпоративного пакета — повод для отдельного разговора. */
  belowMinSeats: boolean;
  /** Полный чек до акции — то, что зачёркнуто на витрине. null вне акции. */
  fullTotalTiyn: number | null;
  /** Размер акции, % (0 вне акции). */
  promoPercent: number;
  /** Надбавка за живые сессии тренера, если пакет выбран. 0 — без тренера. */
  trainerTiyn: number;
}

export interface LeadQuoteInput {
  kind: "B2C" | "B2B";
  seats?: number | null;
  /** Цена курса со страницы курса (B2C). */
  courseTiyn?: number | null;
  /** Цены выбранных в калькуляторе курсов (B2B). */
  selectedCoursesTiyn?: number[];
  /** Выбран пакет с живыми сессиями тренера (B2B). */
  withTrainer?: boolean;
  /**
   * Стоимость тренерского пакета в BYN-копейках. Считает вызывающий код: сумма
   * задана в долларах (lib/pricing TRAINER_PACK_USD), а курс живёт в
   * lib/currency, куда этому чистому модулю ходить незачем.
   */
  trainerTiyn?: number;
}

/** null — выбора не было (заявка с лендинга без курса и без калькулятора). */
export function leadQuote(input: LeadQuoteInput): LeadQuote | null {
  if (input.kind === "B2C") {
    if (!input.courseTiyn || input.courseTiyn <= 0) return null;
    // Акция та же, что на витрине: в заявке должна стоять сумма, которую человек
    // видел на странице курса, иначе счёт разойдётся с обещанием.
    const sale = salePrice(input.courseTiyn);
    return {
      plan: "COURSE",
      seats: null,
      retailTiyn: input.courseTiyn,
      perSeatTiyn: null,
      totalTiyn: sale.tiyn,
      discount: 0,
      tierLabel: null,
      belowMinSeats: false,
      fullTotalTiyn: sale.oldTiyn,
      promoPercent: sale.percent,
      trainerTiyn: 0,
    };
  }

  const seats = input.seats && input.seats > 0 ? input.seats : null;
  if (!seats) return null;

  // База корпоративного расчёта — только набор курсов: доступа «ко всему сразу»
  // у компаний больше нет. Пустой набор считать не по чему — заявка уйдёт без
  // тарифа, и менеджер спросит состав сам.
  const retailTiyn = packRetailTiyn(input.selectedCoursesTiyn ?? []);
  if (retailTiyn <= 0) return null;

  const quote = quoteSeats(seats, retailTiyn);

  // Порядок слоёв повторяет калькулятор (components/landing/seats-calculator):
  // места по сетке → фиксированный пакет тренера на компанию → акция на всё.
  const trainerTiyn = input.withTrainer ? (input.trainerTiyn ?? 0) : 0;
  const fullTotalTiyn = quote.totalTiyn + trainerTiyn;
  const sale = salePrice(fullTotalTiyn);

  return {
    plan: "COURSES",
    seats,
    retailTiyn,
    perSeatTiyn: Math.round(sale.tiyn / seats),
    totalTiyn: sale.tiyn,
    discount: quote.discount,
    tierLabel: quote.tier?.label ?? null,
    belowMinSeats: seats < MIN_B2B_SEATS,
    fullTotalTiyn: sale.oldTiyn,
    promoPercent: sale.percent,
    trainerTiyn,
  };
}
