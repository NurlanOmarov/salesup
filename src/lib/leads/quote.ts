import { MIN_B2B_SEATS, quoteSeats, SUBSCRIPTION_YEAR_TIYN } from "@/lib/pricing";

/**
 * Что человек выбрал перед отправкой заявки и сколько это стоит.
 *
 * Считаем на сервере по тем же правилам, что и калькулятор на витрине
 * (components/landing/seats-calculator): клиент присылает только выбор — режим,
 * курсы, число мест, — а цену выводим сами. Иначе в заявке оказалась бы сумма,
 * которую можно подделать в браузере, и она разошлась бы со счётом.
 */

export type LeadPlanKey = "COURSE" | "LIBRARY" | "COURSES";

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
}): string | null {
  if (!input.plan) return null;
  const br = (tiyn: number) => `${(tiyn / 100).toLocaleString("ru-RU")} Br`;
  const label = PLAN_LABELS[input.plan];

  if (input.plan === "COURSE") {
    return input.totalTiyn ? `Тариф: ${label}, ${br(input.totalTiyn)}` : `Тариф: ${label}`;
  }
  if (!input.perSeatTiyn || !input.totalTiyn || !input.seats) return `Тариф: ${label}`;
  return `Тариф: ${label} — ${br(input.perSeatTiyn)} × ${input.seats} = ${br(input.totalTiyn)}`;
}

export interface LeadQuote {
  plan: LeadPlanKey;
  /** Число мест (B2B); null для розницы. */
  seats: number | null;
  /** Розничная база: цена курса, суммы курсов или годовой подписки. */
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
}

export interface LeadQuoteInput {
  kind: "B2C" | "B2B";
  /** Режим корпоративного калькулятора; для розницы игнорируется. */
  plan?: LeadPlanKey | null;
  seats?: number | null;
  /** Цена курса со страницы курса (B2C). */
  courseTiyn?: number | null;
  /** Цены выбранных в калькуляторе курсов (B2B, режим COURSES). */
  selectedCoursesTiyn?: number[];
  subscriptionYearTiyn?: number;
}

/** null — выбора не было (заявка с лендинга без курса и без калькулятора). */
export function leadQuote(input: LeadQuoteInput): LeadQuote | null {
  const subscription = input.subscriptionYearTiyn ?? SUBSCRIPTION_YEAR_TIYN;

  if (input.kind === "B2C") {
    if (!input.courseTiyn || input.courseTiyn <= 0) return null;
    return {
      plan: "COURSE",
      seats: null,
      retailTiyn: input.courseTiyn,
      perSeatTiyn: null,
      totalTiyn: input.courseTiyn,
      discount: 0,
      tierLabel: null,
      belowMinSeats: false,
    };
  }

  const seats = input.seats && input.seats > 0 ? input.seats : null;
  if (!seats) return null;

  const chosen = (input.selectedCoursesTiyn ?? []).filter((p) => p > 0);
  const chosenSum = chosen.reduce((sum, p) => sum + p, 0);
  // Правило витрины: отдельные курсы никогда не стоят дороже подписки на всё —
  // иначе покупатель платит больше за меньшее.
  const asCourses = input.plan === "COURSES" && chosen.length > 0 && chosenSum < subscription;

  const retailTiyn = asCourses ? chosenSum : subscription;
  const quote = quoteSeats(seats, retailTiyn);

  return {
    plan: asCourses ? "COURSES" : "LIBRARY",
    seats,
    retailTiyn,
    perSeatTiyn: quote.pricePerSeatTiyn,
    totalTiyn: quote.totalTiyn,
    discount: quote.discount,
    tierLabel: quote.tier?.label ?? null,
    belowMinSeats: seats < MIN_B2B_SEATS,
  };
}
