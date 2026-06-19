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
  // Embeddings (только вход)
  "text-embedding-3-small": { inPerMillion: 0.02, outPerMillion: 0 }, // OpenAI (D-001)
  "voyage-3": { inPerMillion: 0.06, outPerMillion: 0 }, // legacy — оставлен для исторических записей
  // Голос (стоимость пишется напрямую через recordVoiceUsage; токенов нет → прайс 0)
  "whisper-1": { inPerMillion: 0, outPerMillion: 0 },
  "gpt-4o-mini-tts": { inPerMillion: 0, outPerMillion: 0 },
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

/**
 * Тарифы голоса (OpenAI, ориентировочно на 2026): STT — за минуту аудио,
 * TTS — за 1000 символов. Стоимость считаем напрямую в microUSD (не через токены).
 */
export const VOICE_PRICES = {
  sttUsdPerMinute: 0.006, // whisper-1
  ttsUsdPer1kChars: 0.015, // gpt-4o-mini-tts (оценка)
};

/** Стоимость распознавания речи (microUSD) по длительности в секундах. */
export function sttCostMicroUsd(seconds: number): number {
  return Math.round((seconds / 60) * VOICE_PRICES.sttUsdPerMinute * 1_000_000);
}

/** Стоимость озвучки (microUSD) по числу символов. */
export function ttsCostMicroUsd(chars: number): number {
  return Math.round((chars / 1000) * VOICE_PRICES.ttsUsdPer1kChars * 1_000_000);
}

/** microUSD → строка «$1.2345» (4 знака; для мелких сумм — больше точности). */
export function formatUsd(microUsd: number): string {
  const usd = microUsd / 1_000_000;
  if (usd === 0) return "$0";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}
