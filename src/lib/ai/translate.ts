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
