import { completeJson } from "./anthropic.js";

/**
 * Перевод субтитровых сегментов (S2.3). Haiku переводит массив фраз батчами,
 * СОХРАНЯЯ порядок и количество (важно для синхронизации с таймкодами) и
 * терминологию продаж. Возвращает массив переводов той же длины.
 */

const LANG_NAMES: Record<string, string> = {
  KK: "казахский",
  EN: "английский",
  UZ: "узбекский",
};

const BATCH = 40;

export async function translateSegments(
  segments: string[],
  targetLang: "KK" | "EN" | "UZ",
  userId?: string | null,
): Promise<string[]> {
  const langName = LANG_NAMES[targetLang] ?? targetLang;
  const out: string[] = [];

  for (let i = 0; i < segments.length; i += BATCH) {
    const batch = segments.slice(i, i + BATCH);
    const result = await completeJson<{ translations: string[] }>({
      model: "claude-haiku-4-5",
      operation: "subtitle.translate",
      userId,
      maxTokens: 4096,
      temperature: 0.2,
      system:
        `Ты переводчик субтитров для курса по продажам. Переводишь массив фраз с русского ` +
        `на ${langName}. СТРОГО сохрани порядок и количество элементов (один перевод на одну фразу). ` +
        `Сохрани терминологию продаж и медицины, естественную для ${langName}. Без пояснений. ` +
        `Верни ТОЛЬКО JSON вида {"translations": ["...", ...]} той же длины, что и вход.`,
      prompt: JSON.stringify({ segments: batch }),
    });
    const translated = result.translations ?? [];
    if (translated.length !== batch.length) {
      // РАНЬШЕ здесь был молчаливый фолбэк на исходный русский текст под чужим
      // языковым лейблом (translated[j] ?? batch[j]!) — если Haiku в батче на 40
      // фраз обрезался по maxTokens и вернул меньше переводов, недостающие
      // реплики публиковались как VALIDATED, хотя оставались русскими. На проде
      // это дало 19 из 30 связок урок×язык в медпред-курсе с примесью русского,
      // два урока — почти полностью нетронутыми (см. аудит 2026-08-19).
      // Батч должен либо перевестись целиком, либо провалиться явно — вызывающий
      // код (subs.ts) должен решать, ретраить или отметить дорожку FAILED.
      throw new Error(
        `translateSegments(${targetLang}): Haiku вернул ${translated.length} переводов вместо ${batch.length} — батч отклонён, а не дополнен исходником`,
      );
    }
    out.push(...translated);
  }

  return out;
}

/**
 * Перевод витринных текстов курса (название, подзаголовок, описание).
 *
 * Отдельно от субтитров: здесь важен не порядок сегментов, а маркетинговый тон и
 * сохранение имён, брендов и цифр. Материалы курса при этом остаются русскими —
 * на карточке об этом сказано явно, поэтому переводим только витрину.
 */
export async function translateCourseCard(
  card: { title: string; subtitle?: string | null; description: string },
  targetLang: "KK" | "UZ",
  userId?: string | null,
): Promise<{ title: string; subtitle: string | null; description: string }> {
  const langName = LANG_NAMES[targetLang] ?? targetLang;
  const script =
    targetLang === "UZ"
      ? "Узбекский — латиницей (современная норма веба)."
      : "Казахский — кириллицей.";

  const result = await completeJson<{
    title: string;
    subtitle: string | null;
    description: string;
  }>({
    model: "claude-haiku-4-5",
    operation: "course.translate",
    userId,
    maxTokens: 2048,
    temperature: 0.2,
    system:
      `Ты переводишь карточку онлайн-курса по продажам с русского на ${langName}. ${script} ` +
      `Сохрани смысл, тон и структуру: перечисления остаются перечислениями, цифры и проценты — ` +
      `без изменений. Имена, названия компаний, домены и термины-бренды (СПИН/SPIN, B2B, DIY, GAPP) ` +
      `не переводи. Не добавляй и не выбрасывай факты. ` +
      `Описание размечено: пустая строка делит абзацы, строки-пункты начинаются с «— ». ` +
      `Сохрани эту разметку символ в символ — переносы строк, пустые строки и маркеры. ` +
      `Верни ТОЛЬКО JSON {"title": "...", "subtitle": "...", "description": "..."}.`,
    prompt: JSON.stringify(card),
  });

  return {
    title: result.title?.trim() || card.title,
    subtitle: result.subtitle?.trim() || null,
    description: result.description?.trim() || card.description,
  };
}
