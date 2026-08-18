"use client";

/**
 * Отправка кастомных событий в маркетинговые счётчики (GA4 + Яндекс.Метрика).
 * Это ТОЛЬКО клиентский маркетинговый слой (CLAUDE.md D-002): источник истины —
 * своя таблица Event, внешние счётчики её лишь дублируют для рекламных отчётов.
 * Вызывать разрешено только на публичных (marketing) страницах. Если счётчики не
 * подключены (id пусты в SEO-настройках) — функция тихо ничего не делает.
 *
 * Счётчики инициализируются в components/analytics/marketing-analytics.tsx;
 * window.gtag / window.ym / window.__ymCounterId проставляются там же.
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    ym?: (counterId: number, action: string, ...args: unknown[]) => void;
    /** Номер счётчика Метрики — нужен для reachGoal (см. marketing-analytics). */
    __ymCounterId?: number;
  }
}

/** Единый словарь имён событий — чтобы отчёты в GA4/Метрике не расползались. */
export type AnalyticsEvent =
  | "lead_start" // клик по CTA «Записаться на курс» / открытие формы заявки
  | "lead_submit" // заявка успешно отправлена
  | "continue_course" // клик «Продолжить обучение» (уже есть доступ)
  | "checkout_start" // клик «Купить» — уход в магазин activesales.by на оплату
  | "ai_demo_try"; // попробовал AI-демо на лендинге

type EventParams = Record<string, string | number | boolean>;

/**
 * Отправить событие в оба счётчика. GA4 доставит его на все настроенные потоки;
 * в Метрике это регистрируется как достижение цели (reachGoal) с тем же именем —
 * такую цель («JavaScript-событие», идентификатор = имя события) заводят в
 * интерфейсе Метрики вручную.
 */
export function trackEvent(event: AnalyticsEvent, params: EventParams = {}): void {
  if (typeof window === "undefined") return;

  window.gtag?.("event", event, params);

  if (window.__ymCounterId) {
    window.ym?.(window.__ymCounterId, "reachGoal", event, params);
  }
}
