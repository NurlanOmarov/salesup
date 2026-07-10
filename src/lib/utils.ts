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

/**
 * Публичный URL обложки курса.
 *  — статический путь/URL (сид-данные «/images/…» или http) → как есть;
 *  — относительный ключ хранилища (залит через админку) → /api/cover/<id>?v=…
 *    (?v= — хвост ключа, меняется при каждой загрузке фото → сброс кэша).
 */
export function coverPublicUrl(
  coverUrl: string | null,
  courseId: string,
): string | null {
  if (!coverUrl) return null;
  if (coverUrl.startsWith("/") || coverUrl.startsWith("http")) return coverUrl;
  const v = coverUrl.slice(coverUrl.lastIndexOf("/") + 1);
  return `/api/cover/${courseId}?v=${encodeURIComponent(v)}`;
}

/**
 * Устойчивое к сборке обращение к БД для ISR-страниц.
 * Образ собирается БЕЗ доступной БД (в CI/Docker), а лендинг/каталог — статичные
 * с `revalidate`. Если при сборке БД недостижима — отдаём fallback, а реальные данные
 * подтянет ISR в рантайме (где БД поднята). В обычной работе ошибки пробрасываются.
 */
export async function buildSafe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const code = (err as { code?: string }).code;
    const isBuild = process.env.NEXT_PHASE === "phase-production-build";
    // P1001/P1000 — Prisma «не удаётся подключиться к БД» (типично при сборке без БД).
    if (isBuild || code === "P1001" || code === "P1000") {
      console.warn("[buildSafe] БД недоступна — отдаю fallback:", (err as Error).message);
      return fallback;
    }
    throw err;
  }
}
