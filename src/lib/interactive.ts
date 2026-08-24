/**
 * Модель данных интерактивных артефактов урока: флеш-карточки и тренажёр возражений.
 *
 * Оба хранятся как JSON в `AiArtifact` (type=FLASHCARDS / OBJECTIONS, одна запись на урок)
 * и рендерятся клиентскими компонентами — без файлов и хранилища медиа. Формат стабилен:
 * фабрика курсов и сидер генерируют ровно эти структуры, критик валидирует так же, как
 * конспекты (см. CLAUDE.md, правило 5).
 */

// ─── Флеш-карточки (тренажёр запоминания: термин → объяснение) ────────────────

/** Одна карточка: лицо (термин/вопрос) и оборот (определение/ответ). */
export interface Flashcard {
  front: string;
  back: string;
}

export interface FlashcardsData {
  cards: Flashcard[];
}

/** Безопасный парсинг набора флеш-карточек из `AiArtifact.content`. null при ошибке. */
export function parseFlashcards(content: string | null | undefined): FlashcardsData | null {
  if (!content) return null;
  try {
    const data = JSON.parse(content) as FlashcardsData;
    if (!data || !Array.isArray(data.cards) || data.cards.length === 0) return null;
    const cards = data.cards.filter(
      (c) => c && typeof c.front === "string" && typeof c.back === "string",
    );
    return cards.length > 0 ? { cards } : null;
  } catch {
    return null;
  }
}

// ─── Тренажёр возражений (интерактивный выбор лучшего ответа клиенту) ──────────

/** Вариант ответа на возражение: текст, признак сильного ответа и пояснение. */
export interface ObjectionOption {
  text: string;
  correct: boolean;
  feedback: string;
}

/** Одно возражение клиента + варианты ответа менеджера + подсказка-вывод. */
export interface ObjectionCard {
  objection: string;
  options: ObjectionOption[];
  tip?: string;
}

export interface ObjectionsData {
  items: ObjectionCard[];
}

/** Безопасный парсинг тренажёра возражений из `AiArtifact.content`. null при ошибке. */
export function parseObjections(content: string | null | undefined): ObjectionsData | null {
  if (!content) return null;
  try {
    const data = JSON.parse(content) as ObjectionsData;
    if (!data || !Array.isArray(data.items) || data.items.length === 0) return null;
    const items = data.items.filter(
      (it) =>
        it &&
        typeof it.objection === "string" &&
        Array.isArray(it.options) &&
        it.options.length >= 2 &&
        it.options.some((o) => o.correct),
    );
    return items.length > 0 ? { items } : null;
  } catch {
    return null;
  }
}

// ─── Чек-лист подготовки (интерактивные пункты с локальным прогрессом) ────────

export interface ChecklistItem {
  text: string;
  hint?: string;
}

export interface ChecklistData {
  title?: string;
  items: ChecklistItem[];
}

/** Безопасный парсинг чек-листа из `AiArtifact.content`. null при ошибке. */
export function parseChecklist(content: string | null | undefined): ChecklistData | null {
  if (!content) return null;
  try {
    const data = JSON.parse(content) as ChecklistData;
    if (!data || !Array.isArray(data.items)) return null;
    const items = data.items.filter((it) => it && typeof it.text === "string");
    return items.length > 0 ? { title: data.title, items } : null;
  } catch {
    return null;
  }
}

// ─── Конструктор скрипта (собрать этапы звонка в правильном порядке) ──────────

/** Шаг скрипта; порядок в массиве = эталонный правильный порядок. */
export interface ScriptStep {
  stage: string; // короткая метка этапа («Приветствие»)
  text: string; // реплика/действие менеджера
}

export interface ScriptBuilderData {
  steps: ScriptStep[];
}

/** Безопасный парсинг конструктора скрипта. Нужно ≥3 шага. null при ошибке. */
export function parseScriptBuilder(content: string | null | undefined): ScriptBuilderData | null {
  if (!content) return null;
  try {
    const data = JSON.parse(content) as ScriptBuilderData;
    if (!data || !Array.isArray(data.steps)) return null;
    const steps = data.steps.filter(
      (s) => s && typeof s.stage === "string" && typeof s.text === "string",
    );
    return steps.length >= 3 ? { steps } : null;
  } catch {
    return null;
  }
}

// ─── «Найди ошибку» в диалоге (отметить неверные реплики менеджера) ───────────

export interface DialogueLine {
  speaker: "manager" | "client";
  text: string;
  error?: boolean; // true — у реплики менеджера есть ошибка
  explanation?: string; // разбор: почему ошибка / почему верно
}

export interface DialogueAuditData {
  items: DialogueLine[];
}

/** Безопасный парсинг тренажёра «найди ошибку». Нужна ≥1 ошибочная реплика. */
export function parseDialogueAudit(content: string | null | undefined): DialogueAuditData | null {
  if (!content) return null;
  try {
    const data = JSON.parse(content) as DialogueAuditData;
    if (!data || !Array.isArray(data.items)) return null;
    const items = data.items.filter(
      (l) => l && (l.speaker === "manager" || l.speaker === "client") && typeof l.text === "string",
    );
    if (items.length < 2 || !items.some((l) => l.speaker === "manager" && l.error)) return null;
    return { items };
  } catch {
    return null;
  }
}

// ─── Тренажёр-метафора (слон/лягушка/гвозди: ученик вводит свои задачи) ────────

/**
 * Визуальная метафора тайм-менеджмента. Ученик вводит СВОИ задачи, анимированный
 * SVG реагирует — контент AI не генерирует (это интерактивная оболочка), поэтому
 * критик валидирует тривиально (см. CLAUDE.md, правило 5). Одна запись на урок.
 */
export type MetaphorVariant = "elephant" | "frog" | "nails";

const METAPHOR_VARIANTS: MetaphorVariant[] = ["elephant", "frog", "nails"];

export interface MetaphorData {
  variant: MetaphorVariant;
  title: string;
  prompt: string;
  /** Цель: elephant — число кусков; nails — ровно столько гвоздей; frog — не используется. */
  goal: number;
  /** Плейсхолдер поля крупной задачи (elephant/frog). */
  bigTaskPlaceholder?: string;
  /** Плейсхолдер поля одного пункта (кусок/задача). */
  itemPlaceholder?: string;
}

/** Безопасный парсинг тренажёра-метафоры. null при неизвестном варианте/битой структуре. */
export function parseMetaphor(content: string | null | undefined): MetaphorData | null {
  if (!content) return null;
  try {
    const data = JSON.parse(content) as MetaphorData;
    if (
      !data ||
      !METAPHOR_VARIANTS.includes(data.variant) ||
      typeof data.title !== "string" ||
      typeof data.prompt !== "string"
    ) {
      return null;
    }
    const goal =
      typeof data.goal === "number" && Number.isFinite(data.goal)
        ? Math.min(12, Math.max(2, Math.round(data.goal)))
        : data.variant === "nails"
          ? 3
          : 5;
    return {
      variant: data.variant,
      title: data.title,
      prompt: data.prompt,
      goal,
      bigTaskPlaceholder:
        typeof data.bigTaskPlaceholder === "string" ? data.bigTaskPlaceholder : undefined,
      itemPlaceholder:
        typeof data.itemPlaceholder === "string" ? data.itemPlaceholder : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Набор метафор одного урока. Урок «лягушка, слон, три гвоздя» держит все три;
 * отдельный урок про лягушку — одну. Принимает и legacy-форму (один объект).
 */
export function parseMetaphors(content: string | null | undefined): MetaphorData[] | null {
  if (!content) return null;
  try {
    const raw = JSON.parse(content) as unknown;
    const list = Array.isArray((raw as { items?: unknown }).items)
      ? (raw as { items: unknown[] }).items
      : [raw];
    const items = list
      .map((it) => parseMetaphor(JSON.stringify(it)))
      .filter((m): m is MetaphorData => m !== null);
    return items.length > 0 ? items : null;
  } catch {
    return null;
  }
}

// ─── Матрица Эйзенхауэра (разложить задачи по 4 квадрантам важно/срочно) ───────

/**
 * Интерактивная матрица: ученик вводит СВОИ задачи и раскладывает по квадрантам
 * (важно×срочно). Оболочка без AI-контента (см. правило 5). Заготовки задач
 * опциональны — можно начать с пустого списка. Одна запись на урок.
 */
export interface EisenhowerData {
  title: string;
  prompt: string;
  /** Необязательные примеры задач для старта (ученик может добавлять свои). */
  seedTasks?: string[];
}

export function parseEisenhower(content: string | null | undefined): EisenhowerData | null {
  if (!content) return null;
  try {
    const data = JSON.parse(content) as EisenhowerData;
    if (!data || typeof data.title !== "string" || typeof data.prompt !== "string") return null;
    const seedTasks = Array.isArray(data.seedTasks)
      ? data.seedTasks.filter((t): t is string => typeof t === "string").slice(0, 12)
      : undefined;
    return { title: data.title, prompt: data.prompt, seedTasks };
  } catch {
    return null;
  }
}

// ─── Правило 60/40 (кольцо дня: планируем ≤60%, остальное — буфер) ────────────

/** Интерактив «правило 60/40». Оболочка без AI-контента (см. правило 5). */
export interface Rule6040Data {
  title: string;
  prompt: string;
  /** Рабочих часов в дне (знаменатель кольца). 1..16, по умолчанию 8. */
  dayHours: number;
  /** Примеры дел {текст, часы} для старта. */
  seedTasks?: { text: string; hours: number }[];
}

export function parseRule6040(content: string | null | undefined): Rule6040Data | null {
  if (!content) return null;
  try {
    const d = JSON.parse(content) as Rule6040Data;
    if (!d || typeof d.title !== "string" || typeof d.prompt !== "string") return null;
    const dayHours =
      typeof d.dayHours === "number" && Number.isFinite(d.dayHours)
        ? Math.min(16, Math.max(1, Math.round(d.dayHours)))
        : 8;
    const seedTasks = Array.isArray(d.seedTasks)
      ? d.seedTasks
          .filter((t) => t && typeof t.text === "string" && typeof t.hours === "number")
          .map((t) => ({ text: t.text, hours: Math.min(dayHours, Math.max(0.5, t.hours)) }))
          .slice(0, 12)
      : undefined;
    return { title: d.title, prompt: d.prompt, dayHours, seedTasks };
  } catch {
    return null;
  }
}

// ─── SMART-цель (5 критериев собирают мишень) ─────────────────────────────────

export interface SmartGoalData {
  title: string;
  prompt: string;
  goalPlaceholder?: string;
}

export function parseSmartGoal(content: string | null | undefined): SmartGoalData | null {
  if (!content) return null;
  try {
    const d = JSON.parse(content) as SmartGoalData;
    if (!d || typeof d.title !== "string" || typeof d.prompt !== "string") return null;
    return {
      title: d.title,
      prompt: d.prompt,
      goalPlaceholder: typeof d.goalPlaceholder === "string" ? d.goalPlaceholder : undefined,
    };
  } catch {
    return null;
  }
}

// ─── Хронометраж / пожиратели времени (круг дня + экстраполяция потерь) ────────

export interface TimeAuditData {
  title: string;
  prompt: string;
  seedActivities?: { text: string; hours: number; waster: boolean }[];
}

export function parseTimeAudit(content: string | null | undefined): TimeAuditData | null {
  if (!content) return null;
  try {
    const d = JSON.parse(content) as TimeAuditData;
    if (!d || typeof d.title !== "string" || typeof d.prompt !== "string") return null;
    const seedActivities = Array.isArray(d.seedActivities)
      ? d.seedActivities
          .filter(
            (a) => a && typeof a.text === "string" && typeof a.hours === "number" && typeof a.waster === "boolean",
          )
          .map((a) => ({ text: a.text, hours: Math.min(24, Math.max(0.25, a.hours)), waster: a.waster }))
          .slice(0, 16)
      : undefined;
    return { title: d.title, prompt: d.prompt, seedActivities };
  } catch {
    return null;
  }
}

// ─── Hotspot-схема (кликабельные точки на изображении) ────────────────────────

export interface HotspotPoint {
  x: number; // 0–100, проценты по ширине
  y: number; // 0–100, проценты по высоте
  label: string;
  text: string;
}

export interface HotspotData {
  image: string; // публичный путь или ключ изображения-схемы
  caption?: string;
  points: HotspotPoint[];
}

/** Безопасный парсинг hotspot-схемы. Нужно изображение и ≥1 точка. */
export function parseHotspot(content: string | null | undefined): HotspotData | null {
  if (!content) return null;
  try {
    const data = JSON.parse(content) as HotspotData;
    if (!data || typeof data.image !== "string" || !Array.isArray(data.points)) return null;
    const points = data.points.filter(
      (p) =>
        p &&
        typeof p.x === "number" &&
        typeof p.y === "number" &&
        typeof p.label === "string" &&
        typeof p.text === "string",
    );
    return points.length > 0 ? { image: data.image, caption: data.caption, points } : null;
  } catch {
    return null;
  }
}

// ─── Типы клиента (зелёный/синий/красный/жёлтый: узнать тип и реакцию) ────────

/**
 * Тренажёр типологии клиента: реплика клиента → ученик определяет тип →
 * выбирает реакцию. Механика несёт смысл урока: ошибка в типе меняет и то,
 * какая реакция окажется эффективной, поэтому шаги идут именно в таком порядке,
 * а шкала доверия показывает накопленный результат разговора.
 */
export type ClientTypeKey = "green" | "blue" | "red" | "yellow";

const CLIENT_TYPE_KEYS: ClientTypeKey[] = ["green", "blue", "red", "yellow"];

export interface ClientTypeReaction {
  text: string;
  correct: boolean;
  feedback: string;
}

export interface ClientTypeCard {
  /** Реплика клиента, по которой определяется тип. */
  quote: string;
  type: ClientTypeKey;
  /** Почему это именно он: скрытая установка типа. */
  hint: string;
  reactions: ClientTypeReaction[];
}

export interface ClientTypesData {
  title?: string;
  prompt?: string;
  cards: ClientTypeCard[];
}

/** Безопасный парсинг тренажёра типов клиента. Нужна ≥1 карточка с верной реакцией. */
export function parseClientTypes(content: string | null | undefined): ClientTypesData | null {
  if (!content) return null;
  try {
    const data = JSON.parse(content) as ClientTypesData;
    if (!data || !Array.isArray(data.cards)) return null;
    const cards = data.cards.filter(
      (c) =>
        c &&
        typeof c.quote === "string" &&
        typeof c.hint === "string" &&
        CLIENT_TYPE_KEYS.includes(c.type) &&
        Array.isArray(c.reactions) &&
        c.reactions.length >= 2 &&
        c.reactions.every((r) => r && typeof r.text === "string" && typeof r.feedback === "string") &&
        c.reactions.some((r) => r.correct),
    );
    return cards.length > 0 ? { title: data.title, prompt: data.prompt, cards } : null;
  } catch {
    return null;
  }
}

// ─── Ветвящийся сценарий (branching: выбор реплики ведёт к разным исходам) ─────

export type BranchOutcome = "win" | "lose" | "neutral";

/** Вариант ответа ученика: текст реплики, переход к узлу, опц. микро-фидбек. */
export interface BranchChoice {
  text: string;
  to: string; // id следующего узла
  note?: string;
}

/** Узел диалога: реплика клиента + варианты ответа (или терминальный исход). */
export interface BranchNode {
  id: string;
  npc: string; // реплика клиента / описание ситуации
  choices?: BranchChoice[]; // пусто/нет → терминальный узел
  outcome?: BranchOutcome; // для терминального узла
  outcomeText?: string;
}

export interface BranchingData {
  title?: string;
  start: string;
  nodes: BranchNode[];
}

/**
 * Целостность графа: старт существует, все переходы ведут к существующим узлам,
 * есть хотя бы один терминальный узел (без вариантов). Чистая функция (юнит-тест).
 */
export function validateBranchingGraph(data: BranchingData): boolean {
  const ids = new Set(data.nodes.map((n) => n.id));
  if (!ids.has(data.start)) return false;
  if (ids.size !== data.nodes.length) return false; // дубликаты id
  let hasTerminal = false;
  for (const n of data.nodes) {
    const choices = n.choices ?? [];
    if (choices.length === 0) hasTerminal = true;
    for (const c of choices) {
      if (!ids.has(c.to)) return false;
    }
  }
  return hasTerminal;
}

/** Безопасный парсинг ветвящегося сценария. null при структурной ошибке/битом графе. */
export function parseBranching(content: string | null | undefined): BranchingData | null {
  if (!content) return null;
  try {
    const data = JSON.parse(content) as BranchingData;
    if (!data || typeof data.start !== "string" || !Array.isArray(data.nodes)) return null;
    const nodes = data.nodes.filter(
      (n): n is BranchNode =>
        !!n &&
        typeof n.id === "string" &&
        typeof n.npc === "string" &&
        (n.choices === undefined ||
          (Array.isArray(n.choices) &&
            n.choices.every((c) => c && typeof c.text === "string" && typeof c.to === "string"))),
    );
    if (nodes.length === 0) return null;
    const clean: BranchingData = { title: data.title, start: data.start, nodes };
    return validateBranchingGraph(clean) ? clean : null;
  } catch {
    return null;
  }
}

// ─── Лестница этапов продажи (climb: 3 шага → «реакция клиента» → закрытие) ───

/**
 * Игра «лестница этапов»: ученик поднимается по названным ступеням урока, на
 * ступени «реакция клиента» видит реплику и выбирает верное действие — закрыть
 * сделку или вернуться к потребностям. Механика несёт правило урока буквально:
 * первая карточка — негативная реакция (правильный ход — откат вниз по
 * лестнице), вторая — позитивная (правильный ход — закрытие наверху).
 * Неверный выбор не откатывает прогресс насовсем — трясёт ступень и даёт
 * попробовать снова, чтобы урок дошёл, а не наказывал случайным кликом.
 */
export interface LadderReactionCard {
  clientLine: string;
  positive: boolean;
  explanation: string;
}

export interface StageLadderData {
  title?: string;
  prompt?: string;
  /** Ровно 5 подписей ступеней, снизу вверх: например «Потребности компании» … «Закрытие сделки». */
  stepTitles: string[];
  /** Ровно 2 карточки: [0] — негативная реакция (учит откату), [1] — позитивная (учит закрытию). */
  reactionCards: LadderReactionCard[];
}

/** Безопасный парсинг лестницы этапов. Нужно ровно 5 ступеней и ровно 2 карточки (негатив, позитив). */
export function parseStageLadder(content: string | null | undefined): StageLadderData | null {
  if (!content) return null;
  try {
    const data = JSON.parse(content) as StageLadderData;
    if (!data || !Array.isArray(data.stepTitles) || data.stepTitles.length !== 5) return null;
    if (!data.stepTitles.every((s) => typeof s === "string" && s.trim())) return null;
    if (!Array.isArray(data.reactionCards) || data.reactionCards.length !== 2) return null;
    const cards = data.reactionCards.filter(
      (c) => c && typeof c.clientLine === "string" && typeof c.explanation === "string" && typeof c.positive === "boolean",
    );
    const [first, second] = cards;
    if (cards.length !== 2 || !first || !second) return null;
    if (first.positive !== false || second.positive !== true) return null;
    return { title: data.title, prompt: data.prompt, stepTitles: data.stepTitles, reactionCards: [first, second] };
  } catch {
    return null;
  }
}

// ─── Весы возражения (выбор ответа наклоняет чашу к «оправданию» или «позитиву») ─

/**
 * Игра «весы возражения»: на каждый раунд — реплика клиента и пул вариантов
 * ответа, среди которых есть оправдания (оправдание = минус, весы клонятся
 * влево, вариант выбывает) и позитивные конструктивные ответы (закрывают
 * раунд, весы клонятся вправо). Два подряд оправдания в раунде — клиент
 * «уходит», раунд начинается заново с тем же пулом. Учит правило урока:
 * возражение не нужно оправдываться, нужно отвечать позитивно.
 */
export interface ScaleOption {
  text: string;
  positive: boolean;
  feedback: string;
}

export interface ScaleRound {
  objection: string;
  options: ScaleOption[];
}

export interface ObjectionScaleData {
  title?: string;
  prompt?: string;
  rounds: ScaleRound[];
}

/** Безопасный парсинг весов возражения. В каждом раунде нужно ≥1 позитивный и ≥1 оправдание. */
export function parseObjectionScale(content: string | null | undefined): ObjectionScaleData | null {
  if (!content) return null;
  try {
    const data = JSON.parse(content) as ObjectionScaleData;
    if (!data || !Array.isArray(data.rounds)) return null;
    const rounds = data.rounds.filter(
      (r) =>
        r &&
        typeof r.objection === "string" &&
        Array.isArray(r.options) &&
        r.options.length >= 2 &&
        r.options.every((o) => o && typeof o.text === "string" && typeof o.feedback === "string" && typeof o.positive === "boolean") &&
        r.options.some((o) => o.positive) &&
        r.options.some((o) => !o.positive),
    );
    return rounds.length > 0 ? { title: data.title, prompt: data.prompt, rounds } : null;
  } catch {
    return null;
  }
}

// ─── Тележка потребностей (собрать вопросы: открытый → альтернативный → закрытый) ─

/**
 * Игра «тележка потребностей»: пул реальных вопросов из урока, у каждого тип —
 * открытый/альтернативный/закрытый. Клик принимается, только если тип вопроса
 * не «раньше» уже собранных по воронке (открытый→альтернативный→закрытый) —
 * иначе тележка «отталкивает» вопрос и объясняет, почему рано. Учит: сначала
 * открытые вопросы, потом уточняющие, закрытые — только под конец.
 */
export type CartQuestionKind = "open" | "alt" | "closed";

export interface CartQuestion {
  text: string;
  kind: CartQuestionKind;
}

export interface NeedsCartData {
  title?: string;
  prompt?: string;
  questions: CartQuestion[];
}

export const CART_KIND_ORDER: Record<CartQuestionKind, number> = { open: 0, alt: 1, closed: 2 };

/** Безопасный парсинг тележки потребностей. Нужно ≥3 вопроса минимум двух разных типов. */
export function parseNeedsCart(content: string | null | undefined): NeedsCartData | null {
  if (!content) return null;
  try {
    const data = JSON.parse(content) as NeedsCartData;
    if (!data || !Array.isArray(data.questions)) return null;
    const questions = data.questions.filter(
      (q): q is CartQuestion => !!q && typeof q.text === "string" && q.text.trim() !== "" && q.kind in CART_KIND_ORDER,
    );
    if (questions.length < 3) return null;
    const kinds = new Set(questions.map((q) => q.kind));
    if (kinds.size < 2) return null;
    return { title: data.title, prompt: data.prompt, questions };
  } catch {
    return null;
  }
}
