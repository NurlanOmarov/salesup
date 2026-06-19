import { db } from "@/lib/db";
import { costMicroUsd, sttCostMicroUsd, ttsCostMicroUsd } from "./pricing.js";

/** Дневные лимиты голоса на ученика (защита от перерасхода, CLAUDE.md правило 10). */
export const VOICE_STT_DAILY_SEC = 600; // 10 минут распознавания речи в день
export const VOICE_TTS_DAILY_CHARS = 15000; // ~ до 25 реплик озвучки в день

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

/** Начало текущих суток UTC (ключ AiUsageDay). */
function utcDay(): Date {
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  return day;
}

/**
 * Учёт голосовой операции: стоимость в LlmUsage (для админки/дайджеста) + счётчик
 * в AiUsageDay (для лимитов и отображения). Токены оставляем нулевыми — голос
 * считается по секундам/символам, а не по токенам.
 */
export async function recordVoiceUsage(params: {
  kind: "stt" | "tts";
  userId: string;
  quantity: number; // STT — секунды аудио; TTS — символы текста
}): Promise<void> {
  const isStt = params.kind === "stt";
  const model = isStt ? "whisper-1" : "gpt-4o-mini-tts";
  const cost = isStt ? sttCostMicroUsd(params.quantity) : ttsCostMicroUsd(params.quantity);
  const qty = Math.max(0, Math.round(params.quantity));
  const day = utcDay();
  await Promise.all([
    db.llmUsage.create({
      data: {
        model,
        operation: isStt ? "voice.stt" : "voice.tts",
        userId: params.userId,
        inputTokens: 0,
        outputTokens: 0,
        costMicroUsd: cost,
      },
    }),
    db.aiUsageDay.upsert({
      where: { userId_day: { userId: params.userId, day } },
      create: {
        userId: params.userId,
        day,
        voiceSttSec: isStt ? qty : 0,
        voiceTtsChars: isStt ? 0 : qty,
      },
      update: isStt ? { voiceSttSec: { increment: qty } } : { voiceTtsChars: { increment: qty } },
    }),
  ]);
}

/** Сегодняшний расход голоса ученика (для проверки лимитов до вызова API). */
export async function voiceUsageToday(userId: string): Promise<{ sttSec: number; ttsChars: number }> {
  const row = await db.aiUsageDay.findUnique({
    where: { userId_day: { userId, day: utcDay() } },
    select: { voiceSttSec: true, voiceTtsChars: true },
  });
  return { sttSec: row?.voiceSttSec ?? 0, ttsChars: row?.voiceTtsChars ?? 0 };
}
