import { describe, expect, it } from "vitest";
import { lessonsLabel, modulesLabel } from "./plural";

describe("lessonsLabel", () => {
  it("склоняет по русским правилам", () => {
    expect(lessonsLabel(1)).toBe("1 урок");
    expect(lessonsLabel(2)).toBe("2 урока");
    expect(lessonsLabel(5)).toBe("5 уроков");
    expect(lessonsLabel(11)).toBe("11 уроков");
    expect(lessonsLabel(21)).toBe("21 урок");
    expect(lessonsLabel(112)).toBe("112 уроков");
    expect(lessonsLabel(0)).toBe("0 уроков");
  });

  it("в казахском и узбекском форма одна", () => {
    expect(lessonsLabel(1, "kk")).toBe("1 сабақ");
    expect(lessonsLabel(5, "kk")).toBe("5 сабақ");
    expect(lessonsLabel(3, "uz")).toBe("3 dars");
  });
});

describe("modulesLabel", () => {
  it("склоняет по русским правилам", () => {
    expect(modulesLabel(1)).toBe("1 модуль");
    expect(modulesLabel(3)).toBe("3 модуля");
    expect(modulesLabel(5)).toBe("5 модулей");
  });
});
