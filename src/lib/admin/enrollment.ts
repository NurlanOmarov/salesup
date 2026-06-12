import type { AccessDuration } from "@prisma/client";

/**
 * Расчёт даты окончания доступа по тарифу курса (S5.1). LIFETIME → бессрочно (null);
 * MONTHS_6 / MONTHS_12 → from + N месяцев. Чистая функция — юнит-тестируемая.
 */
export function computeExpiry(
  duration: AccessDuration,
  from: Date,
): Date | null {
  switch (duration) {
    case "LIFETIME":
      return null;
    case "MONTHS_6":
      return addMonths(from, 6);
    case "MONTHS_12":
      return addMonths(from, 12);
    default:
      return null;
  }
}

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
