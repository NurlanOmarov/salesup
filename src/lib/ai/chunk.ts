/**
 * Разбиение транскрипта на чанки для RAG (S3.1/S7.1). Чистая функция —
 * юнит-тестируема. Режем по абзацам/предложениям до ~maxChars символов с
 * небольшим overlap, чтобы контекст не рвался на границе.
 */

export interface TextChunk {
  seq: number;
  text: string;
}

export function chunkText(
  text: string,
  opts: { maxChars?: number; overlapChars?: number } = {},
): TextChunk[] {
  const maxChars = opts.maxChars ?? 700;
  const overlap = opts.overlapChars ?? 120;

  // Делим на абзацы, затем на предложения — собираем до лимита.
  const sentences = text
    .replace(/\r/g, "")
    .split(/(?<=[.!?…])\s+|\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: TextChunk[] = [];
  let buf = "";
  let seq = 0;

  const push = () => {
    const t = buf.trim();
    if (t) chunks.push({ seq: seq++, text: t });
  };

  for (const s of sentences) {
    if (buf && buf.length + s.length + 1 > maxChars) {
      push();
      // overlap: переносим хвост предыдущего чанка
      buf = overlap > 0 ? buf.slice(-overlap) : "";
    }
    buf = buf ? `${buf} ${s}` : s;
  }
  push();

  return chunks;
}
