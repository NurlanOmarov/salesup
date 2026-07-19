import type { AccessDuration } from "@prisma/client";

/**
 * Расчёт даты окончания доступа (S5.1). LIFETIME → бессрочно (null);
 * MONTHS_N → from + N месяцев. Чистая функция — юнит-тестируемая.
 */
export function computeExpiry(
  duration: AccessDuration,
  from: Date,
): Date | null {
  switch (duration) {
    case "LIFETIME":
      return null;
    case "MONTHS_1":
      return addMonths(from, 1);
    case "MONTHS_3":
      return addMonths(from, 3);
    case "MONTHS_6":
      return addMonths(from, 6);
    case "MONTHS_12":
      return addMonths(from, 12);
    case "MONTHS_24":
      return addMonths(from, 24);
    case "MONTHS_36":
      return addMonths(from, 36);
    default:
      return null;
  }
}

/** Допустимые периоды доступа, которые админ выбирает при выдаче (порядок = порядок в UI). */
export const ACCESS_DURATIONS = [
  "MONTHS_1",
  "MONTHS_3",
  "MONTHS_6",
  "MONTHS_12",
  "MONTHS_24",
  "MONTHS_36",
  "LIFETIME",
] as const satisfies readonly AccessDuration[];

/** Подписи периодов для админ-интерфейса. */
export const ACCESS_DURATION_LABELS: Record<AccessDuration, string> = {
  MONTHS_1: "1 месяц",
  MONTHS_3: "3 месяца",
  MONTHS_6: "6 месяцев",
  MONTHS_12: "1 год",
  MONTHS_24: "2 года",
  MONTHS_36: "3 года",
  LIFETIME: "Бессрочно",
};

/** Прибавить календарные месяцы, корректно обрабатывая переполнение дня месяца. */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const targetMonth = d.getMonth() + months;
  const result = new Date(d.getTime());
  result.setMonth(targetMonth);
  // Если день «перескочил» (31 янв + 1 мес → 3 мар), откатываем на конец месяца.
  if (result.getDate() !== d.getDate()) {
    result.setDate(0);
  }
  return result;
}
