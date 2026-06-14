import { env } from "@/env";
import { recordLlmUsage } from "./usage.js";

/**
 * Клиент эмбеддингов OpenAI (text-embedding-3-small, dimensions=1024, cosine — D-001).
 * Используется гибридным RAG (lib/ai/rag) и фабрикой (scripts/factory/embed).
 * Ключ — в EMBEDDINGS_API_KEY (провайдеро-агностичное имя). Расход пишется в LlmUsage.
 */

const OPENAI_URL = "https://api.openai.com/v1/embeddings";
const MODEL = "text-embedding-3-small";
export const EMBED_DIM = 1024;

/** Низкоуровневый вызов OpenAI. Бросает при не-2xx. dimensions=1024 → совместимо со схемой. */
async function callOpenAI(input: string[], operation: string): Promise<number[][]> {
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.EMBEDDINGS_API_KEY}`,
    },
    body: JSON.stringify({ model: MODEL, input, dimensions: EMBED_DIM }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    data: { embedding: number[]; index: number }[];
    usage?: { total_tokens?: number; prompt_tokens?: number };
  };

  await recordLlmUsage({
    model: MODEL,
    operation,
    inputTokens: json.usage?.total_tokens ?? json.usage?.prompt_tokens ?? 0,
  }).catch(() => {});

  // Восстанавливаем порядок по index (на всякий случай).
  return json.data
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

/**
 * Эмбеддинг поискового запроса. Мягкий: при ошибке/недоступности API возвращает
 * null — RAG тогда работает по полнотексту (graceful degradation).
 */
export async function embedQuery(text: string): Promise<number[] | null> {
  const q = text.trim();
  if (!q) return null;
  try {
    const [vec] = await callOpenAI([q], "embed:query");
    return vec ?? null;
  } catch (err) {
    console.warn("[embeddings] запрос не векторизован:", (err as Error).message);
    return null;
  }
}

/**
 * Эмбеддинг документов (чанков) батчами. Бросает при ошибке — фабрике важно
 * знать, что не записалось (в отличие от мягкого embedQuery).
 */
export async function embedDocuments(
  texts: string[],
  batchSize = 64,
): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const vecs = await callOpenAI(batch, "embed:document");
    out.push(...vecs);
  }
  return out;
}

/** Сериализация вектора в литерал pgvector: [0.1,0.2,...] (для `::vector`-каста). */
export function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}
