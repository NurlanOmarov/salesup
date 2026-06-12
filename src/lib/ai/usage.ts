import { db } from "@/lib/db";
import { costMicroUsd } from "./pricing.js";

/**
 * Запись расхода LLM (учёт в админке). Вызывать ПОСЛЕ каждого вызова Anthropic/Voyage
 * с фактическими токенами из ответа API. Стоимость считается по тарифу и фиксируется
 * в момент записи (прайс может позже измениться — историческая стоимость не «поедет»).
 *
 * userId опционален: системные/фабричные вызовы (генерация курса, переводы, критик)
 * пишутся без ученика; per-ученик операции (чат-наставник, проверка OPEN_TEXT) — с userId.
 */
export async function recordLlmUsage(params: {
  model: string;
  operation: string;
  inputTokens: number;
  outputTokens?: number;
  userId?: string | null;
}): Promise<void> {
  const outputTokens = params.outputTokens ?? 0;
  await db.llmUsage.create({
    data: {
      model: params.model,
      operation: params.operation,
      userId: params.userId ?? null,
      inputTokens: params.inputTokens,
      outputTokens,
      costMicroUsd: costMicroUsd(params.model, params.inputTokens, outputTokens),
    },
  });
}
