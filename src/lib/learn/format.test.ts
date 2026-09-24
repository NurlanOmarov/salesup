import { describe, it, expect } from "vitest";
import { formatTimecode, seededShuffle, unquote } from "./format";

describe("formatTimecode", () => {
  it("форматирует секунды как м:сс", () => {
    expect(formatTimecode(0)).toBe("0:00");
    expect(formatTimecode(5)).toBe("0:05");
    expect(formatTimecode(65)).toBe("1:05");
    expect(formatTimecode(600)).toBe("10:00");
  });

  it("добавляет часы для длинных значений", () => {
    expect(formatTimecode(3600)).toBe("1:00:00");
    expect(formatTimecode(3661)).toBe("1:01:01");
  });

  it("не уходит в минус и округляет вниз", () => {
    expect(formatTimecode(-10)).toBe("0:00");
    expect(formatTimecode(9.9)).toBe("0:09");
  });
});

describe("unquote", () => {
  it("снимает свои кавычки по краям, не трогая внутренние", () => {
    expect(unquote("«Дорого»")).toBe("Дорого");
    expect(unquote("Мне «надо подумать»")).toBe("Мне «надо подумать»");
    expect(unquote("  \"Дорого\" ")).toBe("Дорого");
    expect(unquote("«Дорого», а у них «дешевле»")).toBe("«Дорого», а у них «дешевле»");
  });
});

describe("seededShuffle", () => {
  it("стабилен для одного seed и не теряет элементы", () => {
    const a = seededShuffle([1, 2, 3, 4], "x");
    expect(seededShuffle([1, 2, 3, 4], "x")).toEqual(a);
    expect([...a].sort()).toEqual([1, 2, 3, 4]);
  });

  it("верный ответ не прилипает к первой позиции", () => {
    const firsts = new Set(
      Array.from({ length: 20 }, (_, i) => seededShuffle(["ok", "b", "c", "d"], `q${i}`)[0]),
    );
    expect(firsts.size).toBeGreaterThan(1);
  });
});
