import type { Locale } from "@/i18n/routing";
import { DEFAULT_LOCALE } from "@/i18n/routing";

/**
 * Длительность курса на языке витрины.
 *
 * Подпись («~5 часов 50 минут») владелец задаёт вручную в админке и она точнее
 * суммы длительностей уроков — часть роликов в базе без длительности. Поэтому
 * не пересчитываем, а разбираем подпись на часы и минуты и собираем заново на
 * нужном языке. Не разобралось — показываем как есть: лучше русская подпись,
 * чем пустое место.
 */
// Без \b: в JS граница слова определяется по латинице и цифрам, после
// кириллического окончания она не срабатывает. Достаточно корня слова.
const HOURS_RE = /(\d+)\s*час/i;
const MINUTES_RE = /(\d+)\s*мин/i;

export function parseDurationLabel(label: string | null | undefined): number | null {
  if (!label) return null;
  const hours = Number(HOURS_RE.exec(label)?.[1] ?? 0);
  const minutes = Number(MINUTES_RE.exec(label)?.[1] ?? 0);
  const total = hours * 60 + minutes;
  return total > 0 ? total : null;
}

/** Русское склонение: 1 час / 2 часа / 5 часов. */
function pluralRu(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function formatDuration(minutes: number, locale: Locale): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  if (locale === "kk") {
    // В казахском числительное не меняет форму слова: 1 сағат, 5 сағат.
    return ["~", h ? `${h} сағат` : "", m ? `${m} минут` : ""].filter(Boolean).join(" ").replace("~ ", "~");
  }
  if (locale === "uz") {
    return ["~", h ? `${h} soat` : "", m ? `${m} daqiqa` : ""].filter(Boolean).join(" ").replace("~ ", "~");
  }
  const parts = [
    h ? `${h} ${pluralRu(h, "час", "часа", "часов")}` : "",
    m ? `${m} ${pluralRu(m, "минута", "минуты", "минут")}` : "",
  ].filter(Boolean);
  return `~${parts.join(" ")}`;
}

/** Подпись длительности на языке страницы; для русского — как задал владелец. */
export function localizedDuration(
  label: string | null | undefined,
  locale: Locale,
): string | null {
  if (!label) return null;
  if (locale === DEFAULT_LOCALE) return label;
  const minutes = parseDurationLabel(label);
  return minutes ? formatDuration(minutes, locale) : label;
}
