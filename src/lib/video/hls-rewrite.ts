/**
 * Переписывание HLS-плейлистов на лету (CLAUDE.md, правило 2). Файлы на диске
 * содержат относительные пути сегментов и URI ключа; перед отдачей плеера их
 * заменяем на наши защищённые эндпоинты с подписями. Сами файлы на VPS остаются
 * нетронутыми — переписывание происходит в памяти при каждом запросе.
 *
 * Чистый модуль: трансформация строк, никакого I/O.
 */

/**
 * master.m3u8 → ссылки на варианты заменяются на проксирующий URL.
 * Строки вида `720p/playlist.m3u8` (не начинающиеся с #) → variantUrl("720p").
 */
export function rewriteMasterPlaylist(
  content: string,
  variantUrl: (variantName: string) => string,
): string {
  return content
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed === "" || trimmed.startsWith("#")) return line;
      // ожидаем "<variant>/playlist.m3u8"
      const m = trimmed.match(/^([^/]+)\/playlist\.m3u8$/);
      if (m && m[1]) return variantUrl(m[1]);
      return line;
    })
    .join("\n");
}

/**
 * variant playlist (720p/playlist.m3u8) → сегменты и URI ключа заменяются.
 *  - `seg_0000.ts` → segmentUrl("seg_0000.ts") (подписанный media-URL);
 *  - `#EXT-X-KEY:...URI="..."` → URI заменяется на keyUrl (защищённый эндпоинт ключа).
 */
export function rewriteMediaPlaylist(
  content: string,
  segmentUrl: (segmentName: string) => string,
  keyUrl: string,
): string {
  return content
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed === "") return line;
      if (trimmed.startsWith("#EXT-X-KEY")) {
        return line.replace(/URI="[^"]*"/, `URI="${keyUrl}"`);
      }
      if (trimmed.startsWith("#")) return line;
      // строка сегмента
      return segmentUrl(trimmed);
    })
    .join("\n");
}

/**
 * Извлечь имя варианта и сегмента из относительного ключа сегмента вида
 * `courses/<slug>/lessons/<id>/720p/seg_0001.ts`. Для валидации, что запрошенный
 * media-key действительно принадлежит уроку (defense-in-depth поверх подписи).
 */
export function parseSegmentKey(
  key: string,
): { variant: string; segment: string } | null {
  const m = key.match(/\/(\d+p)\/([^/]+\.ts)$/);
  if (!m || !m[1] || !m[2]) return null;
  return { variant: m[1], segment: m[2] };
}
