import { describe, expect, it } from "vitest";
import { flattenDescription, parseDescription } from "./description";

describe("parseDescription", () => {
  it("делит на абзацы, подводку и список", () => {
    const blocks = parseDescription(
      "Практический видеокурс. Пять уроков.\n\nЧто разбираем:\n— первый пункт;\n— второй пункт\n\nВ конце — итоговый тест.",
    );
    expect(blocks).toEqual([
      { kind: "p", text: "Практический видеокурс. Пять уроков." },
      { kind: "lead", text: "Что разбираем:" },
      { kind: "ul", items: ["первый пункт", "второй пункт"] },
      { kind: "p", text: "В конце — итоговый тест." },
    ]);
  });

  it("текст без разметки остаётся одним абзацем", () => {
    expect(parseDescription("Одна сплошная строка описания")).toEqual([
      { kind: "p", text: "Одна сплошная строка описания" },
    ]);
  });

  it("понимает дефис и точку как маркер списка", () => {
    expect(parseDescription("- дефис\n• точка")).toEqual([
      { kind: "ul", items: ["дефис", "точка"] },
    ]);
  });

  it("пустое описание — пустой список блоков", () => {
    expect(parseDescription(null)).toEqual([]);
    expect(parseDescription("   ")).toEqual([]);
  });
});

describe("flattenDescription", () => {
  it("схлопывает разметку в одну строку для машин", () => {
    expect(flattenDescription("Лид.\n\nЧто внутри:\n— пункт\n— ещё")).toBe(
      "Лид. Что внутри: — пункт — ещё",
    );
  });
});
