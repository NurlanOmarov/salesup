/**
 * Промо-ролики курса на витрине.
 *
 * Все ролики лежат у нас, YouTube на витрине не используется: `file` — ключ
 * сжатого MP4 в lib/storage (`courses/<slug>/promo/<имя>.mp4`, 720p, несколько
 * мегабайт — это витрина, а не урок, правило 10), рядом лежит кадр-превью с тем
 * же именем и расширением .jpg. Шифровать и резать на HLS не нужно — реклама.
 * Заливает фабрика (pnpm factory:promo), раздача публичная: /api/promo/<ключ> → nginx.
 * В базе — список в JSON-поле Course.promoVideos, так же, как learnPoints и faq.
 *
 * `id` — имя файла без расширения. `vertical` — ролик снят вертикально: рамка
 * 9:16 вместо 16:9. `title` — необязательная подпись под роликом.
 */
export interface PromoVideo {
  id: string;
  vertical: boolean;
  title?: string;
  file: string;
}

/** Ключ своего промо-ролика или его превью: только каталог promo курса. */
export const PROMO_FILE_RE = /^courses\/[a-z0-9-]+\/promo\/([a-z0-9-]{1,40})\.mp4$/;
export const PROMO_MEDIA_RE = /^courses\/[a-z0-9-]+\/promo\/[a-z0-9-]{1,40}\.(mp4|jpg)$/;

/** Адрес файла своего ролика (или его превью) для браузера. */
export function promoMediaUrl(key: string): string {
  return `/api/promo/${key}`;
}

/** Ключ кадра-превью своего ролика: тот же файл с расширением .jpg. */
export function promoPosterKey(file: string): string {
  return file.replace(/\.mp4$/, ".jpg");
}

/**
 * Список роликов из JSON-поля курса. Мусор и дубли отбрасываем молча: витрина
 * не место для «поле битое» — ролик либо есть, либо блока просто нет.
 */
export function parsePromoVideos(raw: unknown): PromoVideo[] {
  if (!Array.isArray(raw)) return [];
  const out: PromoVideo[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const { vertical, title, file } = item as Record<string, unknown>;
    // Старые записи с одним YouTube-ID (без file) пропускаем: их больше не играем.
    if (typeof file !== "string") continue;
    const m = file.match(PROMO_FILE_RE);
    if (!m) continue;
    const id = m[1]!;
    if (out.some((v) => v.id === id)) continue;
    out.push({
      id,
      vertical: vertical === true,
      ...(typeof title === "string" && title.trim() ? { title: title.trim() } : {}),
      file,
    });
  }
  return out;
}
