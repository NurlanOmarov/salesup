import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Объединение Tailwind-классов (shadcn/ui-конвенция). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Форматирование цены из tiyn (Int) в строку «49 000 ₸». */
export function formatPrice(tiyn: number): string {
  return (
    Math.round(tiyn / 100).toLocaleString("ru-KZ", { maximumFractionDigits: 0 }) + " ₸"
  );
}
