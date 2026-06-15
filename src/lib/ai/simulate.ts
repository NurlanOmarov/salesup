import { db } from "@/lib/db";
import { complete, completeJson } from "./anthropic.js";
import { clientSystem, DEBRIEF_SYSTEM, renderDialog } from "./prompts/simulate.js";

/**
 * Тренажёр-симулятор диалога (интерактивный формат для продаж). AI отыгрывает
 * клиента по персоне сценария; в конце даёт разбор и оценку. Дневной лимит запусков
 * (AiUsageDay.simulations) защищает от перерасхода. Сценарии валидирует критик —
 * публикуются как SimulationScenario(validation=VALIDATED) (CLAUDE.md, правило 5).
 */

export const SIMULATION_DAILY_LIMIT = 20;

export interface SimMessage {
  role: "student" | "client";
  text: string;
}

/** Проверить и инкрементировать дневной лимит реплик симулятора. Остаток или null. */
async function consumeLimit(userId: string): Promise<number | null> {
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  const usage = await db.aiUsageDay.upsert({
    where: { userId_day: { userId, day } },
    create: { userId, day, simulations: 1 },
    update: { simulations: { increment: 1 } },
    select: { simulations: true },
  });
  if (usage.simulations > SIMULATION_DAILY_LIMIT) return null;
  return SIMULATION_DAILY_LIMIT - usage.simulations;
}

interface ScenarioRow {
  persona: string;
  objectives: string[];
}

function objectivesOf(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((o): o is string => typeof o === "string");
  return [];
}

/** Следующая реплика клиента в ответ на историю диалога. */
export async function replyAsClient(
  userId: string,
  scenario: ScenarioRow,
  history: SimMessage[],
): Promise<{ reply: string; limited?: boolean; remaining: number }> {
  const remaining = await consumeLimit(userId);
  if (remaining === null) {
    return { reply: "Дневной лимит тренажёра исчерпан. Возвращайтесь завтра.", limited: true, remaining: 0 };
  }

  const dialog = renderDialog(history);
  const reply = await complete({
    model: "claude-haiku-4-5",
    system: clientSystem(scenario.persona, scenario.objectives),
    prompt: `${dialog}\n\nОтветь одной короткой репликой как клиент.`,
    maxTokens: 220,
    temperature: 0.85,
    operation: "simulate.reply",
    userId,
  });
  return { reply: reply.trim(), remaining };
}

/** Финальный разбор диалога: оценка + советы. Сохраняет SimulationRun. */
export async function debriefRun(
  userId: string,
  scenarioId: string,
  scenario: ScenarioRow,
  history: SimMessage[],
): Promise<{ scorePct: number; debrief: string }> {
  const dialog = renderDialog(history);
  let result: { scorePct: number; debrief: string };
  try {
    const raw = await completeJson<{ scorePct: number; debrief: string }>({
      model: "claude-haiku-4-5",
      system: DEBRIEF_SYSTEM,
      prompt: `Цели сценария:\n${scenario.objectives.map((o) => `— ${o}`).join("\n")}\n\nДиалог:\n${dialog}`,
      maxTokens: 400,
      temperature: 0.4,
      operation: "simulate.debrief",
      userId,
    });
    result = {
      scorePct: Math.max(0, Math.min(100, Math.round(raw.scorePct))),
      debrief: String(raw.debrief ?? "").trim(),
    };
  } catch {
    result = { scorePct: 0, debrief: "Не удалось сформировать разбор. Попробуйте пройти диалог ещё раз." };
  }

  await db.simulationRun
    .create({
      data: {
        scenarioId,
        userId,
        dialog: history as unknown as object,
        debrief: result.debrief,
        scorePct: result.scorePct,
        finishedAt: new Date(),
      },
    })
    .catch(() => {});

  return result;
}

/** Загрузить валидированный сценарий урока (первый). */
export async function loadScenario(lessonId: string) {
  const s = await db.simulationScenario.findFirst({
    where: { lessonId, validation: "VALIDATED" },
    select: { id: true, title: true, persona: true, objectives: true },
  });
  if (!s) return null;
  return { id: s.id, title: s.title, persona: s.persona, objectives: objectivesOf(s.objectives) };
}
