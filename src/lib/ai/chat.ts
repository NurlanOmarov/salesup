import { db } from "@/lib/db";
import { complete } from "./anthropic.js";
import { searchChunks } from "./rag.js";
import { embedQuery } from "./embeddings.js";
import { TUTOR_SYSTEM, tutorPrompt, NO_ANSWER_MARKER } from "./prompts/tutor.js";

/**
 * AI-наставник (S7.1). Отвечает на вопрос ученика по материалам урока/курса:
 * гибридный RAG (полнотекст + векторы Voyage) → Haiku генерация строго из контекста.
 * При отсутствии релевантного контекста — честный ответ + запись ContentGap (дайджест).
 * Лимит сообщений в день (AiUsageDay) защищает от перерасхода.
 */

export const CHAT_DAILY_LIMIT = 30;

export interface TutorResult {
  answer: string;
  sources: { lessonId: string; lessonTitle: string }[];
  limited?: boolean;
  remaining: number;
}

/** Проверить и инкрементировать дневной лимит сообщений. Возвращает остаток, либо null если исчерпан. */
async function consumeDailyLimit(userId: string): Promise<number | null> {
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  const usage = await db.aiUsageDay.upsert({
    where: { userId_day: { userId, day } },
    create: { userId, day, chatMessages: 1 },
    update: { chatMessages: { increment: 1 } },
    select: { chatMessages: true },
  });
  if (usage.chatMessages > CHAT_DAILY_LIMIT) return null;
  return CHAT_DAILY_LIMIT - usage.chatMessages;
}

export async function askTutor(
  userId: string,
  lessonId: string,
  courseId: string,
  message: string,
): Promise<TutorResult> {
  const remaining = await consumeDailyLimit(userId);
  if (remaining === null) {
    return { answer: "Дневной лимит вопросов исчерпан. Возвращайтесь завтра.", sources: [], limited: true, remaining: 0 };
  }

  // Эмбеддинг запроса считаем один раз и переиспользуем для обоих скоупов
  // (мягко: при недоступности Voyage → null, RAG деградирует до полнотекста).
  const queryEmbedding = await embedQuery(message);

  // RAG: сначала в рамках урока, при недостатке — по всему курсу.
  let chunks = await searchChunks(message, { courseIds: [courseId], lessonId }, 5, { queryEmbedding });
  if (chunks.length < 2) {
    chunks = await searchChunks(message, { courseIds: [courseId] }, 6, { queryEmbedding });
  }

  if (chunks.length === 0) {
    // Нет контекста → честный ответ + ContentGap для владельца.
    await db.contentGap.create({ data: { userId, lessonId, question: message.slice(0, 500) } }).catch(() => {});
    return {
      answer: `К сожалению, ${NO_ANSWER_MARKER}. Попробуйте переформулировать вопрос или загляните в другие уроки курса.`,
      sources: [],
      remaining,
    };
  }

  const context = chunks.map((c, i) => `[${i + 1}] ${c.text}`).join("\n\n");
  const answer = await complete({
    model: "claude-haiku-4-5",
    system: TUTOR_SYSTEM,
    prompt: tutorPrompt(message, context),
    maxTokens: 700,
    temperature: 0.3,
    operation: "tutor.chat",
    userId,
  });

  // Источники — уникальные уроки найденных чанков.
  const lessonIds = [...new Set(chunks.map((c) => c.lessonId))];
  const lessons = await db.lesson.findMany({ where: { id: { in: lessonIds } }, select: { id: true, title: true } });
  const titleById = new Map(lessons.map((l) => [l.id, l.title]));
  const sources = lessonIds.map((id) => ({ lessonId: id, lessonTitle: titleById.get(id) ?? "Урок" }));

  return { answer, sources, remaining };
}
