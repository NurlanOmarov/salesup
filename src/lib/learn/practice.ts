/**
 * Тренажёры урока — общий словарь для клиента и сервера (без db).
 *
 * Тренажёры (лестница этапов, весы, «найди ошибку», карточки…) работают в браузере.
 * Раньше они не оставляли следа, и ученики проходили курс по цепочке «видео → тест»,
 * не открывая практику. Теперь у урока есть ГЛАВНЫЙ тренажёр — шаг пути между видео
 * и заданием, а завершение любого тренажёра записывается (PracticeResult) и даёт XP.
 */

/**
 * Виды тренажёров в порядке приоритета выбора главного. Сверху — игры, где механика
 * сама передаёт смысл урока; внизу — то, что лучше работает как дополнение
 * (симулятор тратит LLM-лимит, карточки и схема — повторение, а не отработка).
 */
export const PRACTICE_KINDS = [
  "STAGE_LADDER",
  "OBJECTION_SCALE",
  "NEEDS_CART",
  "CLIENT_TYPES",
  "ECONOMY_CALC",
  "BRANCHING",
  "DIALOGUE_AUDIT",
  "SCRIPT_BUILDER",
  "OBJECTIONS",
  "RAPID_FIRE",
  "TASK_METAPHOR",
  "EISENHOWER",
  "RULE_6040",
  "SMART_GOAL",
  "TIME_AUDIT",
  "SIMULATION",
  "FLASHCARDS",
  "HOTSPOT",
] as const;

export type PracticeKind = (typeof PRACTICE_KINDS)[number];

export const PRACTICE_LABELS: Record<PracticeKind, string> = {
  STAGE_LADDER: "Лестница этапов",
  OBJECTION_SCALE: "Весы возражения",
  NEEDS_CART: "Тележка потребностей",
  CLIENT_TYPES: "Типы клиента",
  ECONOMY_CALC: "Расчёт выгоды",
  BRANCHING: "Сценарий разговора",
  DIALOGUE_AUDIT: "Найди ошибку",
  SCRIPT_BUILDER: "Собери скрипт",
  OBJECTIONS: "Выбери лучший ответ",
  RAPID_FIRE: "Возражения на скорость",
  TASK_METAPHOR: "Тренажёр-метафора",
  EISENHOWER: "Матрица Эйзенхауэра",
  RULE_6040: "Правило 60/40",
  SMART_GOAL: "SMART-цель",
  TIME_AUDIT: "Пожиратели времени",
  SIMULATION: "Симулятор диалога",
  FLASHCARDS: "Карточки",
  HOTSPOT: "Схема",
};

/**
 * Типы AiArtifact, которые являются тренажёрами. CHECKLIST сюда не входит: это
 * памятка к работе, а не отработка. RAPID_FIRE строится из OBJECTIONS, SIMULATION —
 * из SimulationScenario, поэтому своих артефактов у них нет.
 */
export const TRAINER_ARTIFACT_TYPES = PRACTICE_KINDS.filter(
  (k): k is Exclude<PracticeKind, "RAPID_FIRE" | "SIMULATION"> =>
    k !== "RAPID_FIRE" && k !== "SIMULATION",
);

export function isPracticeKind(v: string): v is PracticeKind {
  return (PRACTICE_KINDS as readonly string[]).includes(v);
}

/** Главный тренажёр урока — первый доступный по приоритету; null — тренажёров нет. */
export function pickMainTrainer(available: Iterable<PracticeKind>): PracticeKind | null {
  const set = new Set(available);
  return PRACTICE_KINDS.find((k) => set.has(k)) ?? null;
}

/** Балл тренажёра 0–100 из «сколько верно из скольких»; null, если считать не из чего. */
export function toScorePct(correct: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((correct / total) * 100)));
}
