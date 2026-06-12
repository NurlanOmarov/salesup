import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Объединение Tailwind-классов (shadcn/ui-конвенция). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
