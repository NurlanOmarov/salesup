/**
 * Парсинг VTT-субтитров YouTube (S3.1). Авто-субтитры приходят «прокручивающимися»
 * (rolling): соседние реплики дублируют хвост предыдущей. Дедуплицируем и собираем
 * чистый текст с таймкодами. Чистый модуль — юнит-тестируем.
 */

export interface VttCue {
  startSec: number;
  text: string;
}

/** «00:01:23.456» | «01:23.456» → секунды. */
export function parseTimestamp(ts: string): number {
  const parts = ts.split(":").map((p) => parseFloat(p.replace(",", ".")));
  if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  if (parts.length === 2) return parts[0]! * 60 + parts[1]!;
  return parts[0] ?? 0;
}

const TS_LINE = /(\d{2}:)?\d{2}:\d{2}[.,]\d{3}\s*-->\s*(\d{2}:)?\d{2}:\d{2}[.,]\d{3}/;

/** Убрать инлайновые теги (<c>, <00:00:01.000>) и схлопнуть пробелы. */
function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Разобрать VTT в реплики с дедупликацией прокручивающихся авто-субтитров.
 * Каждую реплику добавляем, отрезая префикс, совпадающий с хвостом накопленного текста.
 */
export function parseVtt(vtt: string): VttCue[] {
  const lines = vtt.split(/\r?\n/);
  const cues: VttCue[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (TS_LINE.test(line)) {
      const startStr = line.split("-->")[0]!.trim();
      const startSec = parseTimestamp(startStr);
      i++;
      const textLines: string[] = [];
      while (i < lines.length && lines[i]!.trim() !== "" && !TS_LINE.test(lines[i]!)) {
        const t = stripTags(lines[i]!);
        if (t) textLines.push(t);
        i++;
      }
      const text = textLines.join(" ").trim();
      if (text) cues.push({ startSec, text });
    } else {
      i++;
    }
  }

  return dedupeRolling(cues);
}

/** Склейка прокручивающихся субтитров: отбрасываем повторяющиеся строки. */
function dedupeRolling(cues: VttCue[]): VttCue[] {
  const out: VttCue[] = [];
  let lastText = "";
  for (const cue of cues) {
    if (cue.text === lastText) continue;
    // авто-субтитры часто повторяют предыдущую строку как первую — оставляем только новое
    out.push(cue);
    lastText = cue.text;
  }
  return out;
}

/**
 * Дописать слова `next` к `acc`, отрезав максимальное перекрытие: хвост acc,
 * совпадающий с началом next (прокручивающиеся авто-субтитры повторяют контекст).
 */
function appendWithOverlap(acc: string[], next: string[]): string[] {
  const maxK = Math.min(acc.length, next.length);
  for (let k = maxK; k > 0; k--) {
    if (acc.slice(-k).join(" ") === next.slice(0, k).join(" ")) {
      return acc.concat(next.slice(k));
    }
  }
  return acc.concat(next);
}

/** Собрать сплошной текст транскрипта без таймкодов (для дальнейшей очистки LLM). */
export function cuesToRawText(cues: VttCue[]): string {
  let words: string[] = [];
  for (const c of cues) {
    words = appendWithOverlap(words, c.text.split(/\s+/).filter(Boolean));
  }
  return words.join(" ").replace(/\s+/g, " ").trim();
}

/** mm:ss из секунд (для разметки абзацев). */
export function fmtTimecode(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Сегмент субтитров с интервалом времени. */
export interface SubtitleCue {
  startSec: number;
  endSec: number;
  text: string;
}

/**
 * Агрегировать «прокручивающиеся» реплики в субтитровые сегменты для дорожки:
 * группируем по ~maxChars символов / maxDurSec секунд, чтобы не было мельтешения.
 * Возвращает интервальные cue [start, end).
 */
export function aggregateCues(
  cues: VttCue[],
  opts: { maxChars?: number; maxDurSec?: number } = {},
): SubtitleCue[] {
  const maxChars = opts.maxChars ?? 90;
  const maxDurSec = opts.maxDurSec ?? 6;
  // Сначала собираем уникальный текст с overlap-merge (как в cuesToRawText), но
  // сохраняя время начала каждого нового фрагмента.
  const out: SubtitleCue[] = [];
  let buf = "";
  let bufStart = cues[0]?.startSec ?? 0;
  let prevWords: string[] = [];

  const flush = (endSec: number) => {
    const text = buf.trim();
    if (text) out.push({ startSec: bufStart, endSec, text });
    buf = "";
  };

  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i]!;
    const words = cue.text.split(/\s+/).filter(Boolean);
    // новая часть = слова cue без перекрытия с хвостом предыдущего
    let k = Math.min(prevWords.length, words.length);
    while (k > 0 && prevWords.slice(-k).join(" ") !== words.slice(0, k).join(" ")) k--;
    const fresh = words.slice(k).join(" ");
    prevWords = words;
    if (!fresh) continue;

    if (buf === "") bufStart = cue.startSec;
    buf = buf ? `${buf} ${fresh}` : fresh;

    const dur = cue.startSec - bufStart;
    if (buf.length >= maxChars || dur >= maxDurSec) {
      flush(cue.startSec + 2);
    }
  }
  flush((cues[cues.length - 1]?.startSec ?? bufStart) + 3);
  return out;
}

/** Время в формат VTT 00:00:00.000. */
export function vttTimestamp(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec - Math.floor(sec)) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

/** Собрать VTT-файл из субтитровых сегментов. */
export function cuesToVtt(cues: SubtitleCue[]): string {
  const lines = ["WEBVTT", ""];
  for (const c of cues) {
    lines.push(`${vttTimestamp(c.startSec)} --> ${vttTimestamp(Math.max(c.endSec, c.startSec + 1))}`);
    lines.push(c.text);
    lines.push("");
  }
  return lines.join("\n");
}
