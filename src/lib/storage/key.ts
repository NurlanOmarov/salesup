/**
 * Валидация относительных ключей хранилища. Ключ — POSIX-путь вида
 * `courses/<slug>/lessons/<id>/master.m3u8`. Защита от path traversal:
 * ключ не должен выходить за пределы хранилища, быть абсолютным или содержать `..`.
 */
export class InvalidStorageKeyError extends Error {
  constructor(key: string, reason: string) {
    super(`Недопустимый ключ хранилища "${key}": ${reason}`);
    this.name = "InvalidStorageKeyError";
  }
}

const SEGMENT_RE = /^[A-Za-z0-9._-]+$/;

/**
 * Нормализует и проверяет ключ. Возвращает канонический ключ (без ведущего/
 * хвостового слэша, без дублей слэшей). Бросает при любой попытке traversal.
 */
export function normalizeKey(key: string): string {
  if (typeof key !== "string" || key.length === 0) {
    throw new InvalidStorageKeyError(String(key), "пустой ключ");
  }
  if (key.includes("\0")) {
    throw new InvalidStorageKeyError(key, "содержит null-байт");
  }
  if (key.includes("\\")) {
    throw new InvalidStorageKeyError(key, "обратный слэш запрещён (только POSIX)");
  }
  if (key.startsWith("/")) {
    throw new InvalidStorageKeyError(key, "абсолютный путь запрещён");
  }

  const segments = key.split("/").filter((s) => s.length > 0);
  if (segments.length === 0) {
    throw new InvalidStorageKeyError(key, "нет значимых сегментов");
  }
  for (const seg of segments) {
    if (seg === "." || seg === "..") {
      throw new InvalidStorageKeyError(key, "сегменты . и .. запрещены");
    }
    if (!SEGMENT_RE.test(seg)) {
      throw new InvalidStorageKeyError(
        key,
        `сегмент "${seg}" содержит недопустимые символы`,
      );
    }
  }
  return segments.join("/");
}
