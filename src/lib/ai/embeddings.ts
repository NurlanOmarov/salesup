import { env } from "@/env";
import { recordLlmUsage } from "./usage.js";

/**
 * Клиент эмбеддингов Voyage AI (voyage-3, 1024 изм., cosine — D-001).
 * Используется гибридным RAG (lib/ai/rag) и фабрикой (scripts/factory/embed).
 * Расход токенов пишется в LlmUsage (model "voyage-3"), как и у Anthropic-вызовов.
 */

const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
const MODEL = "voyage-3";
export const EMBED_DIM = 1024;

/** Низкоуровневый вызов Voyage. Бросает при не-2xx. input_type улучшает retrieval. */
async function callVoyage(
  input: string[],
  inputType: "query" | "document",
  operation: string,
): Promise<number[][]> {
  const res = await fetch(VOYAGE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.EMBEDDINGS_API_KEY}`,
    },
    body: JSON.stringify({ model: MODEL, input, input_type: inputType }),
  });

  if (!res.ok) {
    throw new Error(`Voyage ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    data: { embedding: number[]; index: number }[];
    usage?: { total_tokens?: number };
  };

  await recordLlmUsage({
    model: MODEL,
    operation,
    inputTokens: json.usage?.total_tokens ?? 0,
  }).catch(() => {});

  // Voyage гарантирует соответствие порядку input по полю index — пересортируем на всякий.
  return json.data
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

/**
 * Эмбеддинг поискового запроса. Мягкий: при ошибке/недоступности Voyage возвращает
 * null — RAG тогда работает по полнотексту (graceful degradation).
 */
export async function embedQuery(text: string): Promise<number[] | null> {
  const q = text.trim();
  if (!q) return null;
  try {
    const [vec] = await callVoyage([q], "query", "embed:query");
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
  batchSize = 32,
): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const vecs = await callVoyage(batch, "document", "embed:document");
    out.push(...vecs);
  }
  return out;
}

/** Сериализация вектора в литерал pgvector: [0.1,0.2,...] (для `::vector`-каста). */
export function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}
