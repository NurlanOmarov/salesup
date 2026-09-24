/**
 * Промо-ролики курса на витрине.
 *
 * Видео живут на YouTube и никогда не копируются к нам: диск VPS — под уроки
 * (CLAUDE.md, правило 10). В базе лежит только список ID в JSON-поле
 * Course.promoVideos — так же, как learnPoints и faq.
 *
 * `vertical` — ролик снят вертикально (Shorts): рамка 9:16 вместо 16:9.
 * `title` — необязательная подпись под роликом; собственные названия с YouTube
 * не берём, там хвост хештегов.
 *
 * Исключение — ролики, которых на YouTube нет (рилсы, присланные файлом). Их
 * кладём к себе: `file` — ключ сжатого MP4 в lib/storage
 * (`courses/<slug>/promo/<имя>.mp4`, 720p, несколько мегабайт), рядом лежит
 * кадр-превью с тем же именем и расширением .jpg. `id` у такого ролика — само
 * имя файла. Раздача публичная: /api/promo/<ключ> → nginx.
 */
export interface PromoVideo {
  id: string;
  vertical: boolean;
  title?: string;
  file?: string;
}

const ID_RE = /^[A-Za-z0-9_-]{11}$/;

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
 * ID ролика из любой ссылки YouTube (watch, youtu.be, /shorts/, /embed/, /live/)
 * или из уже готового ID. Не распознали — null.
 */
export function youtubeId(input: string): string | null {
  const v = input.trim();
  if (ID_RE.test(v)) return v;
  const m = v.match(/(?:v=|youtu\.be\/|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{11})/);
  return m?.[1] ?? null;
}

/** Ссылка вида youtube.com/shorts/... — ролик заведомо вертикальный. */
export function isShortsUrl(input: string): boolean {
  return /\/shorts\//.test(input);
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
    const { id: rawId, vertical, title, file } = item as Record<string, unknown>;
    let id: string;
    let ownFile: string | undefined;
    if (typeof file === "string") {
      const m = file.match(PROMO_FILE_RE);
      if (!m) continue;
      id = m[1]!;
      ownFile = file;
    } else {
      if (typeof rawId !== "string" || !ID_RE.test(rawId)) continue;
      id = rawId;
    }
    if (out.some((v) => v.id === id)) continue;
    out.push({
      id,
      vertical: vertical === true,
      ...(typeof title === "string" && title.trim() ? { title: title.trim() } : {}),
      ...(ownFile ? { file: ownFile } : {}),
    });
  }
  return out;
}
