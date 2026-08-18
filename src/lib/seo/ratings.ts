import type { SeoSettings } from "@prisma/client";

/**
 * Оценки школы на внешних площадках. Чистый модуль (без server-only): значения
 * приходят из SeoSettings, но правило отбора — «показываем только то, что можно
 * проверить по ссылке» — нужно и футеру, и тестам.
 */
/** Рейтинги на внешних площадках для блока доверия (пустые — не показываем). */
export function externalRatings(s: SeoSettings) {
  return [
    {
      source: "yandex" as const,
      label: "Яндекс Карты",
      href: s.yandexMapsUrl,
      rating: s.yandexRating,
      reviews: s.yandexReviews,
    },
    {
      source: "google" as const,
      label: "Google Карты",
      href: s.googleMapsUrl,
      rating: s.googleRating,
      reviews: s.googleReviews,
    },
  ]
    .filter((r): r is typeof r & { href: string; rating: number } =>
      Boolean(r.href && r.rating),
    )
    .map((r) => ({ ...r, reviews: r.reviews ?? null }));
}
