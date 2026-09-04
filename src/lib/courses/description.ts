/**
 * Разбор описания курса на блоки для витрины.
 *
 * Описание владелец пишет обычным текстом в админке, но сплошная простыня на
 * 8–10 строк не читается: глаз не цепляется ни за что. Поэтому поддерживаем
 * лёгкую разметку — пустая строка делит абзацы, строка с тире или дефисом в
 * начале становится пунктом списка, абзац с двоеточием на конце — подводкой к
 * нему. Ничего сложнее (жирный, ссылки) намеренно нет: текст должен оставаться
 * читаемым как есть — он же уходит в SEO-описание и в RAG.
 */
export type DescriptionBlock =
  | { kind: "p"; text: string }
  /** Абзац-подводка к списку («Что разбираем:»). */
  | { kind: "lead"; text: string }
  | { kind: "ul"; items: string[] };

const BULLET_RE = /^\s*[—–\-•*]\s+/;

/** Пункт списка без маркера и без завершающих «;»/«.» — их рисует вёрстка. */
function cleanItem(line: string): string {
  return line.replace(BULLET_RE, "").trim().replace(/[;.]$/, "");
}

export function parseDescription(text: string | null | undefined): DescriptionBlock[] {
  if (!text) return [];
  const blocks: DescriptionBlock[] = [];
  let items: string[] = [];

  const flushList = () => {
    if (items.length > 0) {
      blocks.push({ kind: "ul", items });
      items = [];
    }
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      flushList();
      continue;
    }
    if (BULLET_RE.test(line)) {
      items.push(cleanItem(line));
      continue;
    }
    flushList();
    blocks.push({ kind: line.endsWith(":") ? "lead" : "p", text: line });
  }
  flushList();

  return blocks;
}

/** Однострочный вариант описания — для JSON-LD, мета-тегов и прочих машин. */
export function flattenDescription(text: string | null | undefined): string {
  return (text ?? "").replace(/\s*\n+\s*/g, " ").replace(/\s{2,}/g, " ").trim();
}
