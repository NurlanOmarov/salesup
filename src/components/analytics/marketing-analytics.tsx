import { getSeoSettings } from "@/lib/seo/settings";
import { CookieConsent } from "./cookie-consent";

/**
 * Маркетинговые счётчики (GA4 / Яндекс.Метрика) — ТОЛЬКО на публичных (marketing)
 * страницах (CLAUDE.md D-002: источник истины — своя Event; внешние счётчики — лишь
 * маркетинговый слой). В кабинет ученика НЕ подключать (правило 9, ПДн). Id пусты →
 * ничего не рендерится. Значения задаются в админке «SEO-настройки».
 *
 * Сами скрипты грузит клиентский CookieConsent — после согласия посетителя
 * (Закон РБ № 99-З: аналитика с трансграничной передачей требует согласия).
 * Пока счётчики не настроены, баннер не показывается: технически необходимые
 * cookie согласия не требуют.
 */
export async function MarketingAnalytics() {
  const { ga4Id, yandexMetricaId } = await getSeoSettings();
  if (!ga4Id && !yandexMetricaId) return null;

  return (
    <CookieConsent
      ga4Id={ga4Id ?? null}
      yandexMetricaId={yandexMetricaId ?? null}
    />
  );
}
