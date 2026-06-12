import { describe, it, expect } from "vitest";
import { chunkText } from "./chunk.js";

describe("chunkText", () => {
  it("короткий текст → один чанк", () => {
    const c = chunkText("Привет. Как дела?");
    expect(c).toHaveLength(1);
    expect(c[0]!.seq).toBe(0);
  });

  it("длинный текст разбивается на несколько чанков", () => {
    const sentence = "Это предложение про продажи и работу медпреда. ";
    const c = chunkText(sentence.repeat(60), { maxChars: 300 });
    expect(c.length).toBeGreaterThan(1);
    c.forEach((ch) => expect(ch.text.length).toBeLessThanOrEqual(420));
  });

  it("seq последователен", () => {
    const c = chunkText("Раз. Два. Три. ".repeat(50), { maxChars: 50 });
    c.forEach((ch, i) => expect(ch.seq).toBe(i));
  });

  it("пустой текст → нет чанков", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n  ")).toEqual([]);
  });

  it("разбивает по двойному переводу строки (абзацы)", () => {
    const c = chunkText("Первый абзац короткий.\n\nВторой абзац тоже.", { maxChars: 25 });
    expect(c.length).toBeGreaterThanOrEqual(2);
  });
});
