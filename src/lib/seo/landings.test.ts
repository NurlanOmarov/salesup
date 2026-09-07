import { describe, it, expect } from "vitest";
import { parseFaq } from "./landings";

describe("parseFaq", () => {
  it("оставляет только пары со строковыми вопросом и ответом", () => {
    const rows = parseFaq([
      { q: "Сколько длится курс?", a: "Четыре урока." },
      { q: "", a: "пусто" },
      { q: "Без ответа" },
      "мусор",
      null,
    ]);
    expect(rows).toEqual([{ q: "Сколько длится курс?", a: "Четыре урока." }]);
  });

  it("не падает на пустом значении из базы", () => {
    expect(parseFaq(null)).toEqual([]);
    expect(parseFaq(undefined)).toEqual([]);
    expect(parseFaq({})).toEqual([]);
  });
});
