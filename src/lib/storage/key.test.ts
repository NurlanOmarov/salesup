import { describe, it, expect } from "vitest";
import { normalizeKey, InvalidStorageKeyError } from "./key.js";

describe("normalizeKey", () => {
  it("принимает валидный ключ", () => {
    expect(normalizeKey("courses/sales-tourism/lessons/abc/master.m3u8")).toBe(
      "courses/sales-tourism/lessons/abc/master.m3u8",
    );
  });

  it("схлопывает дубли слэшей и хвостовые слэши", () => {
    expect(normalizeKey("courses//slug/")).toBe("courses/slug");
  });

  it.each([
    ["", "пустой"],
    ["/etc/passwd", "абсолютный"],
    ["../secret", "traversal вверх"],
    ["courses/../../etc", "traversal в середине"],
    ["courses/./x", "сегмент ."],
    ["a\\b", "обратный слэш"],
    ["a\0b", "null-байт"],
    ["courses/with space", "пробел"],
    ["courses/with$char", "спецсимвол"],
  ])("отклоняет %s (%s)", (bad) => {
    expect(() => normalizeKey(bad)).toThrow(InvalidStorageKeyError);
  });
});
