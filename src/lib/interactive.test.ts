import { describe, it, expect } from "vitest";
import {
  parseFlashcards,
  parseObjections,
  parseChecklist,
  parseScriptBuilder,
  parseDialogueAudit,
  parseHotspot,
} from "./interactive";

describe("parseFlashcards", () => {
  it("парсит валидный набор карточек", () => {
    const json = JSON.stringify({ cards: [{ front: "A", back: "B" }] });
    expect(parseFlashcards(json)).toEqual({ cards: [{ front: "A", back: "B" }] });
  });

  it("отбрасывает битые карточки, оставляя валидные", () => {
    const json = JSON.stringify({ cards: [{ front: "A", back: "B" }, { front: 1 }] });
    expect(parseFlashcards(json)).toEqual({ cards: [{ front: "A", back: "B" }] });
  });

  it("возвращает null на пустом/невалидном входе", () => {
    expect(parseFlashcards(null)).toBeNull();
    expect(parseFlashcards("{}")).toBeNull();
    expect(parseFlashcards("не json")).toBeNull();
    expect(parseFlashcards(JSON.stringify({ cards: [] }))).toBeNull();
  });
});

describe("parseObjections", () => {
  const valid = {
    items: [
      {
        objection: "Дорого",
        options: [
          { text: "Ответ 1", correct: true, feedback: "ок" },
          { text: "Ответ 2", correct: false, feedback: "нет" },
        ],
        tip: "подсказка",
      },
    ],
  };

  it("парсит валидный тренажёр", () => {
    expect(parseObjections(JSON.stringify(valid))).toEqual(valid);
  });

  it("отбрасывает элементы без правильного варианта или с одним вариантом", () => {
    const bad = {
      items: [
        { objection: "X", options: [{ text: "a", correct: false, feedback: "" }, { text: "b", correct: false, feedback: "" }] },
        { objection: "Y", options: [{ text: "a", correct: true, feedback: "" }] },
      ],
    };
    expect(parseObjections(JSON.stringify(bad))).toBeNull();
  });

  it("возвращает null на пустом/невалидном входе", () => {
    expect(parseObjections(null)).toBeNull();
    expect(parseObjections("{}")).toBeNull();
    expect(parseObjections(JSON.stringify({ items: [] }))).toBeNull();
  });
});

describe("parseChecklist", () => {
  it("парсит и отбрасывает битые пункты", () => {
    const json = JSON.stringify({ title: "T", items: [{ text: "a" }, { text: 1 }] });
    expect(parseChecklist(json)).toEqual({ title: "T", items: [{ text: "a" }] });
  });
  it("null на пустом", () => {
    expect(parseChecklist(JSON.stringify({ items: [] }))).toBeNull();
    expect(parseChecklist(null)).toBeNull();
  });
});

describe("parseScriptBuilder", () => {
  it("требует ≥3 шага", () => {
    const ok = { steps: [{ stage: "a", text: "1" }, { stage: "b", text: "2" }, { stage: "c", text: "3" }] };
    expect(parseScriptBuilder(JSON.stringify(ok))).toEqual(ok);
    expect(parseScriptBuilder(JSON.stringify({ steps: [{ stage: "a", text: "1" }] }))).toBeNull();
  });
});

describe("parseDialogueAudit", () => {
  it("требует хотя бы одну ошибочную реплику менеджера", () => {
    const ok = {
      items: [
        { speaker: "client", text: "c" },
        { speaker: "manager", text: "m", error: true, explanation: "e" },
      ],
    };
    expect(parseDialogueAudit(JSON.stringify(ok))).toEqual(ok);
    const noErr = { items: [{ speaker: "client", text: "c" }, { speaker: "manager", text: "m" }] };
    expect(parseDialogueAudit(JSON.stringify(noErr))).toBeNull();
  });
});

describe("parseHotspot", () => {
  it("требует изображение и ≥1 точку", () => {
    const ok = { image: "/x.png", points: [{ x: 1, y: 2, label: "l", text: "t" }] };
    expect(parseHotspot(JSON.stringify(ok))).toEqual({ image: "/x.png", caption: undefined, points: ok.points });
    expect(parseHotspot(JSON.stringify({ image: "/x.png", points: [] }))).toBeNull();
    expect(parseHotspot(JSON.stringify({ points: [{ x: 1, y: 2, label: "l", text: "t" }] }))).toBeNull();
  });
});
