import { describe, it, expect } from "vitest";
import { xpForLevel, levelForXp, levelProgress } from "./levels.js";

describe("xpForLevel", () => {
  it("уровень 1 → 0 XP", () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(0)).toBe(0);
  });
  it("растущие пороги", () => {
    expect(xpForLevel(2)).toBe(100);
    expect(xpForLevel(3)).toBe(300);
    expect(xpForLevel(4)).toBe(600);
    expect(xpForLevel(5)).toBe(1000);
  });
});

describe("levelForXp", () => {
  it("0 XP → уровень 1", () => {
    expect(levelForXp(0)).toBe(1);
  });
  it("на пороге уровня", () => {
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(300)).toBe(3);
  });
  it("между порогами — нижний уровень", () => {
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(299)).toBe(2);
    expect(levelForXp(599)).toBe(3);
  });
});

describe("levelProgress", () => {
  it("в начале уровня 2", () => {
    const p = levelProgress(100);
    expect(p.level).toBe(2);
    expect(p.intoLevel).toBe(0);
    expect(p.span).toBe(200); // 300 - 100
    expect(p.percent).toBe(0);
  });
  it("середина уровня", () => {
    const p = levelProgress(200); // уровень 2, floor 100, next 300
    expect(p.level).toBe(2);
    expect(p.intoLevel).toBe(100);
    expect(p.percent).toBe(50);
  });
  it("почти следующий уровень", () => {
    const p = levelProgress(299);
    expect(p.level).toBe(2);
    expect(p.percent).toBe(99);
  });
});
