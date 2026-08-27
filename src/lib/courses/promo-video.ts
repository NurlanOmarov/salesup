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
 */
export interface PromoVideo {
  id: string;
  vertical: boolean;
  title?: string;
}

const ID_RE = /^[A-Za-z0-9_-]{11}$/;

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
    const { id, vertical, title } = item as Record<string, unknown>;
    if (typeof id !== "string" || !ID_RE.test(id)) continue;
    if (out.some((v) => v.id === id)) continue;
    out.push({
      id,
      vertical: vertical === true,
      ...(typeof title === "string" && title.trim() ? { title: title.trim() } : {}),
    });
  }
  return out;
}
