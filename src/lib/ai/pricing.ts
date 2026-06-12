/**
 * Тарифы LLM и расчёт стоимости вызовов (учёт расходов в админке).
 * Цены — USD за 1 000 000 токенов, по прайсу Anthropic / Voyage на 2026 год.
 * При изменении прайса обновлять только эту таблицу — расчёт пересчитается везде.
 *
 * Стоимость храним и считаем в microUSD (1 USD = 1 000 000 microUSD), Int —
 * как деньги в tiyn: без ошибок округления float. Чистый модуль, юнит-тестируемый.
 */

export interface ModelPrice {
  /** USD за 1M входных токенов. */
  inPerMillion: number;
  /** USD за 1M выходных токенов (для embeddings — 0). */
  outPerMillion: number;
}

/** Прайс по моделям. Ключи — значения, которые пишутся в LlmUsage.model. */
export const MODEL_PRICES: Record<string, ModelPrice> = {
  // Anthropic Claude
  "claude-haiku-4-5": { inPerMillion: 1.0, outPerMillion: 5.0 },
  "claude-sonnet-4-6": { inPerMillion: 3.0, outPerMillion: 15.0 },
  "claude-opus-4-8": { inPerMillion: 15.0, outPerMillion: 75.0 },
  // Voyage embeddings (только вход)
  "voyage-3": { inPerMillion: 0.06, outPerMillion: 0 },
};

/** Фоллбэк-прайс для неизвестной модели (консервативно — как Sonnet). */
const FALLBACK: ModelPrice = { inPerMillion: 3.0, outPerMillion: 15.0 };

export function priceFor(model: string): ModelPrice {
  return MODEL_PRICES[model] ?? FALLBACK;
}

/**
 * Стоимость вызова в microUSD (целое). microUSD = токены × (USD/1M),
 * т.к. (tokens / 1e6) × pricePerMillion × 1e6 = tokens × pricePerMillion.
 */
export function costMicroUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = priceFor(model);
  return Math.round(inputTokens * p.inPerMillion + outputTokens * p.outPerMillion);
}

/** microUSD → строка «$1.2345» (4 знака; для мелких сумм — больше точности). */
export function formatUsd(microUsd: number): string {
  const usd = microUsd / 1_000_000;
  if (usd === 0) return "$0";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}
