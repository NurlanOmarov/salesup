import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/env";
import { recordLlmUsage } from "./usage.js";

/**
 * Обёртка над Anthropic API (CLAUDE.md: Haiku — чат/критик/переводы, Sonnet —
 * генерация). Каждый вызов автоматически пишет расход токенов в LlmUsage (учёт в
 * админке). Ключи прайса (MODEL_PRICES) совпадают с алиасами ниже.
 */

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

/** Алиас (= ключ прайса) → реальный model id Anthropic API. */
export const MODELS = {
  "claude-haiku-4-5": "claude-haiku-4-5-20251001",
  "claude-sonnet-4-6": "claude-sonnet-4-6",
} as const;

export type ModelAlias = keyof typeof MODELS;

export interface CompleteOptions {
  model: ModelAlias;
  system?: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  operation: string;
  userId?: string | null;
}

/** Один запрос-ответ. Возвращает текст; расход токенов фиксируется в LlmUsage. */
export async function complete(opts: CompleteOptions): Promise<string> {
  const res = await client.messages.create({
    model: MODELS[opts.model],
    max_tokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature ?? 0.7,
    ...(opts.system ? { system: opts.system } : {}),
    messages: [{ role: "user", content: opts.prompt }],
  });

  await recordLlmUsage({
    model: opts.model,
    operation: opts.operation,
    userId: opts.userId ?? null,
    inputTokens: res.usage.input_tokens,
    outputTokens: res.usage.output_tokens,
  });

  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/**
 * Запрос JSON-ответа с разбором. Просит модель вернуть строго JSON, парсит первый
 * JSON-объект/массив из ответа. Бросает при невалидном JSON (вызывающий ретраит).
 */
export async function completeJson<T>(opts: CompleteOptions): Promise<T> {
  const text = await complete(opts);
  const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!match) throw new Error("Модель не вернула JSON");
  return JSON.parse(match[0]) as T;
}

export type VisionMediaType = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

export interface CompleteVisionOptions extends CompleteOptions {
  /** Картинка в base64 (без префикса data:). */
  imageBase64: string;
  mediaType: VisionMediaType;
}

/** Запрос с картинкой (vision): текстовый промпт + изображение. Расход — в LlmUsage. */
export async function completeVision(opts: CompleteVisionOptions): Promise<string> {
  const res = await client.messages.create({
    model: MODELS[opts.model],
    max_tokens: opts.maxTokens ?? 512,
    temperature: opts.temperature ?? 0.5,
    ...(opts.system ? { system: opts.system } : {}),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: opts.mediaType, data: opts.imageBase64 },
          },
          { type: "text", text: opts.prompt },
        ],
      },
    ],
  });

  await recordLlmUsage({
    model: opts.model,
    operation: opts.operation,
    userId: opts.userId ?? null,
    inputTokens: res.usage.input_tokens,
    outputTokens: res.usage.output_tokens,
  });

  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}
