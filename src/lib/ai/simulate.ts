import type { PersonaArchetype } from "@prisma/client";
import { db } from "@/lib/db";
import { complete, completeJson } from "./anthropic.js";
import { clientSystem, scorecardSystem, renderDialog } from "./prompts/simulate.js";

/**
 * Тренажёр-симулятор диалога (интерактивный формат для продаж). AI отыгрывает
 * клиента по персоне/архетипу сценария; в конце даёт scorecard по фазам визита и
 * проверяет compliance. Дневной лимит запусков (AiUsageDay.simulations) защищает
 * от перерасхода. Сценарии валидирует критик — публикуются как
 * SimulationScenario(validation=VALIDATED) (CLAUDE.md, правило 5).
 */

export const SIMULATION_DAILY_LIMIT = 20;

export interface SimMessage {
  role: "student" | "client";
  text: string;
}

export type SimPhase = "opening" | "discovery" | "presentation" | "objections" | "closing";

export interface PhaseScore {
  phase: SimPhase;
  label: string;
  score: number; // 0..100
  comment: string;
}

export interface ComplianceFlag {
  severity: "fail" | "warn";
  rule: string;
  quote: string;
  explanation: string;
}

export interface Scorecard {
  phases: PhaseScore[];
  overallPct: number; // 0..100, средневзвешенное по фазам
  passed: boolean; // false при любом флаге severity="fail"
  complianceFlags: ComplianceFlag[];
  strengths: string[];
  improvements: string[];
  topTip: string;
}

/** Дефолтная рубрика фаз визита медпреда (если у сценария нет своей). */
export const DEFAULT_RUBRIC: { phase: SimPhase; label: string; weight: number }[] = [
  { phase: "opening", label: "Открытие визита", weight: 0.15 },
  { phase: "discovery", label: "Выявление потребности", weight: 0.25 },
  { phase: "presentation", label: "Презентация с доказательной базой", weight: 0.25 },
  { phase: "objections", label: "Работа с возражениями", weight: 0.2 },
  { phase: "closing", label: "Закрытие на следующий шаг", weight: 0.15 },
];

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

export interface ScenarioRow {
  persona: string;
  objectives: string[];
  archetype: PersonaArchetype;
  difficulty: number;
  complianceRules: string[];
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
    system: clientSystem(scenario.persona, scenario.objectives, scenario.archetype, scenario.difficulty),
    prompt: `${dialog}\n\nОтветь одной короткой репликой как клиент.`,
    maxTokens: 220,
    temperature: 0.85,
    operation: "simulate.reply",
    userId,
  });
  return { reply: reply.trim(), remaining };
}

const KNOWN_PHASES = new Set<SimPhase>(["opening", "discovery", "presentation", "objections", "closing"]);

/** Нормализовать фазы из ответа модели и посчитать взвешенный overallPct. */
export function buildScorecard(raw: Partial<Scorecard>): Scorecard {
  const weights = new Map(DEFAULT_RUBRIC.map((r) => [r.phase, r.weight]));
  const phases: PhaseScore[] = Array.isArray(raw.phases)
    ? raw.phases
        .filter((p): p is PhaseScore => !!p && KNOWN_PHASES.has(p.phase as SimPhase))
        .map((p) => ({
          phase: p.phase,
          label: String(p.label ?? p.phase),
          score: Math.max(0, Math.min(100, Math.round(Number(p.score) || 0))),
          comment: String(p.comment ?? "").trim(),
        }))
    : [];

  const totalWeight = phases.reduce((s, p) => s + (weights.get(p.phase) ?? 0), 0);
  const overallPct =
    totalWeight > 0
      ? Math.round(phases.reduce((s, p) => s + p.score * (weights.get(p.phase) ?? 0), 0) / totalWeight)
      : 0;

  const complianceFlags: ComplianceFlag[] = Array.isArray(raw.complianceFlags)
    ? raw.complianceFlags
        .filter((f): f is ComplianceFlag => !!f && (f.severity === "fail" || f.severity === "warn"))
        .map((f) => ({
          severity: f.severity,
          rule: String(f.rule ?? "").trim(),
          quote: String(f.quote ?? "").trim(),
          explanation: String(f.explanation ?? "").trim(),
        }))
    : [];

  const hasFail = complianceFlags.some((f) => f.severity === "fail");
  const passed = typeof raw.passed === "boolean" ? raw.passed && !hasFail : !hasFail;

  const toList = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((x) => x.trim()) : [];

  return {
    phases,
    overallPct,
    passed,
    complianceFlags,
    strengths: toList(raw.strengths),
    improvements: toList(raw.improvements),
    topTip: String(raw.topTip ?? "").trim(),
  };
}

/** Финальный разбор диалога: scorecard по фазам + compliance. Сохраняет SimulationRun. */
export async function scoreRun(
  userId: string,
  scenarioId: string,
  scenario: ScenarioRow,
  history: SimMessage[],
): Promise<Scorecard> {
  const dialog = renderDialog(history);
  const prompt = `Цели сценария:\n${scenario.objectives.map((o) => `— ${o}`).join("\n")}\n\nДиалог:\n${dialog}`;

  // LLM иногда возвращает невалидный JSON (кавычки в цитатах реплик) — один ретрай перед fallback.
  let scorecard: Scorecard | null = null;
  for (let attempt = 0; attempt < 2 && !scorecard; attempt++) {
    try {
      const raw = await completeJson<Partial<Scorecard>>({
        model: "claude-haiku-4-5",
        system: scorecardSystem(scenario.complianceRules),
        prompt,
        maxTokens: 1800, // полный scorecard на русском (кириллица «дорогая» по токенам) не должен обрезаться
        temperature: attempt === 0 ? 0.4 : 0.2,
        operation: "simulate.scorecard",
        userId,
      });
      scorecard = buildScorecard(raw);
    } catch {
      scorecard = null;
    }
  }
  if (!scorecard) {
    scorecard = {
      phases: [],
      overallPct: 0,
      passed: false,
      complianceFlags: [],
      strengths: [],
      improvements: [],
      topTip: "Не удалось сформировать разбор. Попробуйте пройти диалог ещё раз.",
    };
  }

  await db.simulationRun
    .create({
      data: {
        scenarioId,
        userId,
        dialog: history as unknown as object,
        scorecard: scorecard as unknown as object,
        complianceFlags: scorecard.complianceFlags as unknown as object,
        passed: scorecard.passed,
        // обратная совместимость со старым плоским форматом
        scorePct: scorecard.overallPct,
        debrief: scorecard.topTip,
        finishedAt: new Date(),
      },
    })
    .catch(() => {});

  return scorecard;
}

/** Загрузить валидированный сценарий урока (первый). */
export async function loadScenario(lessonId: string) {
  const s = await db.simulationScenario.findFirst({
    where: { lessonId, validation: "VALIDATED" },
    select: {
      id: true,
      title: true,
      persona: true,
      objectives: true,
      archetype: true,
      difficulty: true,
      complianceRules: true,
    },
  });
  if (!s) return null;
  return {
    id: s.id,
    title: s.title,
    persona: s.persona,
    objectives: objectivesOf(s.objectives),
    archetype: s.archetype,
    difficulty: s.difficulty,
  };
}

/** Разобрать complianceRules (Json) в массив строк. */
export function complianceRulesOf(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((r): r is string => typeof r === "string");
  return [];
}
