/**
 * Модель данных презентации урока.
 *
 * Презентация хранится как JSON в `AiArtifact(type=SLIDES)` (одна колода на урок) и
 * рендерится клиентским просмотрщиком `<SlideDeck>` — без файлов и хранилища медиа.
 * Формат стабилен: фабрика курсов и сидер генерируют ровно эти структуры, критик
 * валидирует так же, как конспекты (см. CLAUDE.md, правило 5).
 */

/** Акцентная тема колоды — задаёт градиент обложки/финала. */
export type DeckTheme = "amber" | "violet" | "sky" | "emerald" | "rose";

/** Обложка — первый слайд. */
export interface CoverSlide {
  layout: "cover";
  kicker?: string; // надзаголовок (модуль / номер урока)
  title: string;
  subtitle?: string;
}

/** Список тезисов: маркированный или нумерованный (шаги/правила/вопросы). */
export interface ListSlide {
  layout: "list";
  title: string;
  intro?: string;
  numbered?: boolean;
  items: { lead?: string; text: string }[];
}

/** Две колонки: «делай / не делай», «мы / конкурент», «до / после». */
export interface SplitSlide {
  layout: "split";
  title: string;
  left: { heading: string; tone?: "good" | "bad" | "neutral"; items: string[] };
  right: { heading: string; tone?: "good" | "bad" | "neutral"; items: string[] };
}

/** Цитата / ключевая формула урока. */
export interface QuoteSlide {
  layout: "quote";
  text: string;
  caption?: string;
}

/** Финальный слайд-итог. */
export interface OutroSlide {
  layout: "outro";
  title: string;
  subtitle?: string;
}

export type DeckSlide = CoverSlide | ListSlide | SplitSlide | QuoteSlide | OutroSlide;

export interface SlideDeckData {
  theme?: DeckTheme;
  slides: DeckSlide[];
}

/** Безопасный парсинг JSON-колоды из `AiArtifact.content`. Возвращает null при ошибке. */
export function parseDeck(content: string | null | undefined): SlideDeckData | null {
  if (!content) return null;
  try {
    const data = JSON.parse(content) as SlideDeckData;
    if (!data || !Array.isArray(data.slides) || data.slides.length === 0) return null;
    return data;
  } catch {
    return null;
  }
}
