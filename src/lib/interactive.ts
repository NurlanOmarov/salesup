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
