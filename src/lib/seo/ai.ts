import "server-only";
import { complete } from "@/lib/ai/anthropic";

/**
 * AI-ассистент SEO-метаданных (Anthropic Haiku — CLAUDE.md: Haiku для проверок/
 * коротких генераций). Владелец не пишет title/description с нуля, а получает
 * черновик из уже имеющегося контента (описание курса + целевой запрос) и правит.
 * Это override-слой поверх фабрики, а не замена критику (правило 5).
 *
 * Лимиты подобраны под сниппет Google: title ≤ ~60 симв., description ≤ ~155.
 */

export const SEO_TITLE_MAX = 60;
export const SEO_DESC_MAX = 155;

export interface MetaSuggestion {
  title: string;
  description: string;
}

const SYSTEM =
  "Ты SEO-редактор образовательной платформы по продажам (рынок Беларусь, язык — " +
  "русский). По исходному описанию страницы пишешь SEO-title и meta description для " +
  "выдачи Google. СТРОГИЕ правила: 1) title ≤ 60 символов, description ≤ 155 символов " +
  "(это жёсткие лимиты сниппета — не превышать); 2) естественно вписываешь целевой " +
  "запрос, если он дан, без спама-переспама; 3) описание — с пользой и мягким призывом, " +
  "без кликбейта и без обещаний, которых нет в исходнике; 4) не выдумывай факты, " +
  "цены, цифры; 5) без эмодзи и КАПСА. Верни ТОЛЬКО JSON без markdown: " +
  '{"title":"...","description":"..."}.';

function buildPrompt(source: string, focusKeyword?: string | null): string {
  return (
    `Исходное описание страницы:\n${source.trim().slice(0, 4000)}\n\n` +
    (focusKeyword?.trim()
      ? `Целевой поисковый запрос: «${focusKeyword.trim()}».\n\n`
      : "") +
    `Верни JSON {"title","description"} по правилам (title ≤ ${SEO_TITLE_MAX}, ` +
    `description ≤ ${SEO_DESC_MAX} символов).`
  );
}

/** Аккуратная обрезка по границе слова до лимита (страховка от превышения лимита LLM). */
function clampWords(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
}

/**
 * Сгенерировать SEO-title и description из исходного текста (описание курса/страницы).
 * userId — для учёта расхода токенов в LlmUsage (админка «Расходы LLM»).
 */
export async function generateMeta(
  source: string,
  opts: { focusKeyword?: string | null; userId?: string | null } = {},
): Promise<MetaSuggestion> {
  if (!source.trim()) throw new Error("Нет исходного текста для генерации");

  const raw = await complete({
    model: "claude-haiku-4-5",
    system: SYSTEM,
    prompt: buildPrompt(source, opts.focusKeyword),
    maxTokens: 400,
    temperature: 0.5,
    operation: "seo:meta",
    userId: opts.userId ?? null,
  });

  let parsed: { title?: unknown; description?: unknown };
  try {
    // На случай, если модель обернула в ```json — вырезаем первый JSON-объект.
    const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    parsed = JSON.parse(json);
  } catch {
    throw new Error("AI вернул неожиданный формат — повторите попытку");
  }

  const title = typeof parsed.title === "string" ? parsed.title : "";
  const description =
    typeof parsed.description === "string" ? parsed.description : "";
  if (!title && !description) throw new Error("AI не вернул метаданные");

  return {
    title: clampWords(title, SEO_TITLE_MAX),
    description: clampWords(description, SEO_DESC_MAX),
  };
}

// ─────────────────────────── AI-критик SEO (замена чеклиста Yoast) ───────────────────────────

export interface MetaScore {
  score: number; // 0..100
  issues: string[]; // что не так
  suggestions: string[]; // как улучшить
}

const SCORE_SYSTEM =
  "Ты SEO-аудитор. Оцениваешь пару title+description страницы курса по продажам " +
  "(рынок Беларусь, русский). Критерии: длина (title ≤ 60, description ≤ 155 симв.), " +
  "естественное присутствие целевого запроса, читабельность и польза, отсутствие " +
  "кликбейта/переспама, соответствие описанию страницы. Верни ТОЛЬКО JSON без markdown: " +
  '{"score": <0..100>, "issues": ["..."], "suggestions": ["..."]}. ' +
  "issues и suggestions — короткие пункты на русском (0–4 шт.), пустые массивы если всё ок.";

export interface ScoreInput {
  title: string;
  description: string;
  focusKeyword?: string | null;
  source?: string | null; // фактическое содержание страницы (для проверки соответствия)
}

/**
 * Оценить качество метаданных (0..100) + список проблем и рекомендаций (Anthropic Haiku).
 * Информационный сигнал владельцу, а не блокировка — публикацию контролирует критик
 * контента (правило 5); это помощник ручной настройки SEO.
 */
export async function scoreMeta(
  input: ScoreInput,
  opts: { userId?: string | null } = {},
): Promise<MetaScore> {
  const prompt =
    `Title: ${input.title || "(пусто)"}\n` +
    `Description: ${input.description || "(пусто)"}\n` +
    (input.focusKeyword?.trim()
      ? `Целевой запрос: «${input.focusKeyword.trim()}»\n`
      : "") +
    (input.source?.trim()
      ? `\nСодержание страницы (фрагмент):\n${input.source.trim().slice(0, 2500)}\n`
      : "") +
    `\nОцени и верни JSON {"score","issues","suggestions"}.`;

  const raw = await complete({
    model: "claude-haiku-4-5",
    system: SCORE_SYSTEM,
    prompt,
    maxTokens: 500,
    temperature: 0.3,
    operation: "seo:score",
    userId: opts.userId ?? null,
  });

  let parsed: { score?: unknown; issues?: unknown; suggestions?: unknown };
  try {
    const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    parsed = JSON.parse(json);
  } catch {
    throw new Error("AI вернул неожиданный формат — повторите попытку");
  }

  const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)));
  const asStrings = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 4) : [];

  return {
    score,
    issues: asStrings(parsed.issues),
    suggestions: asStrings(parsed.suggestions),
  };
}

// ─────────────────────────── AI-черновик текста thin-страниц ───────────────────────────

export type StaticDraftPage = "/offer" | "/privacy";

const DRAFT_SPECS: Record<StaticDraftPage, { name: string; brief: string }> = {
  "/offer": {
    name: "Публичная оферта",
    brief:
      "Договор публичной оферты онлайн-платформы курсов: предмет (доступ к видеокурсам " +
      "и AI-тренажёрам), порядок оплаты (без онлайн-оплаты: заявка → подтверждение → " +
      "администратор выдаёт логин/пароль), срок доступа, запрет передачи учётной записи " +
      "и распространения материалов, интеллектуальная собственность, порядок претензий, " +
      "ответственность сторон, изменение условий.",
  },
  "/privacy": {
    name: "Политика конфиденциальности",
    brief:
      "Политика обработки персональных данных по закону Республики Беларусь «О защите " +
      "персональных данных» (№ 99-З): состав данных (имя, e-mail/логин, телефон — " +
      "опционально), цели обработки (доступ к курсам, сертификат, уведомления), " +
      "правовые основания, сроки хранения, права субъекта (доступ, исправление, " +
      "удаление, отзыв согласия), передача третьим лицам (нет, кроме законных " +
      "требований), cookie и счётчики аналитики, контакт для обращений.",
  },
};

/**
 * Черновик текста статической страницы (markdown). Sonnet — длинная генерация
 * (CLAUDE.md: Sonnet для генерации). Только по кнопке владельца; результат владелец
 * читает и правит перед сохранением — это НЕ автопубликация (юридический текст
 * стоит показать юристу, о чём напоминает подсказка в форме).
 */
export async function draftStaticPageText(
  page: StaticDraftPage,
  opts: { orgName: string; siteUrl: string; contact?: string | null; userId?: string | null },
): Promise<string> {
  const spec = DRAFT_SPECS[page];
  const raw = await complete({
    model: "claude-sonnet-4-6",
    system:
      "Ты юрист-редактор, пишешь документы для сайтов на русском языке (рынок — " +
      "Республика Беларусь). Пиши структурированный markdown: заголовки разделов «## 1. …», " +
      "нумерованные пункты, без преамбул и комментариев вне документа. Нейтральный " +
      "деловой стиль. Не выдумывай реквизиты (УНП, адрес) — оставляй плейсхолдеры вида " +
      "«[указать …]». Объём — 400–700 слов.",
    prompt:
      `Напиши документ «${spec.name}» для сайта ${opts.siteUrl} ` +
      `(владелец — ${opts.orgName}${opts.contact ? `, контакт: ${opts.contact}` : ""}).\n\n` +
      `Содержание: ${spec.brief}\n\nВерни только markdown-текст документа.`,
    maxTokens: 3000,
    temperature: 0.4,
    operation: "seo:page-draft",
    userId: opts.userId ?? null,
  });

  const text = raw.trim();
  if (!text) throw new Error("AI не вернул текст");
  return text;
}
