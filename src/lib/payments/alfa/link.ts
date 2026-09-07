import { z } from "zod";

/**
 * Платёжная ссылка курса из личного кабинета Альфа-Банка
 * (docs/ALFA-PAYMENT-LINKS.md §6).
 *
 * Схема живёт отдельным модулем, а не в admin/courses/actions.ts: тот файл
 * помечен "use server", и Next требует, чтобы каждая функция в нём была async —
 * встроенная проверка внутри zod-схемы ломала сборку.
 */

/** Только домен банка: чужой адрес в этом поле означал бы увод оплаты на сторону. */
export function isAlfaPaymentUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith("alfabank.by");
  } catch {
    return false;
  }
}

/** Поле «Ссылка на оплату» в админке курса: адрес банка либо пусто. */
export const alfaPaymentUrlSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || isAlfaPaymentUrl(value), {
    message: "Укажите ссылку с сайта банка (https://ecom.alfabank.by/…)",
  })
  .optional();
