import { describe, it, expect } from "vitest";
import { reciprocalRankFusion } from "./rag.js";

describe("reciprocalRankFusion", () => {
  it("документ, встретившийся в обоих списках, ранжируется выше одиночных", () => {
    const fused = reciprocalRankFusion([
      ["a", "b", "c"],
      ["b", "d", "a"],
    ]);
    const ids = fused.map((f) => f.id);
    // a и b есть в обоих списках → должны опережать c и d (по одному списку)
    expect(ids.indexOf("a")).toBeLessThan(ids.indexOf("c"));
    expect(ids.indexOf("b")).toBeLessThan(ids.indexOf("d"));
    expect(ids[0] === "a" || ids[0] === "b").toBe(true);
  });

  it("единственный список сохраняет исходный порядок", () => {
    const fused = reciprocalRankFusion([["x", "y", "z"]]);
    expect(fused.map((f) => f.id)).toEqual(["x", "y", "z"]);
  });

  it("пустые списки → пустой результат", () => {
    expect(reciprocalRankFusion([[], []])).toEqual([]);
  });

  it("score выше у более высокой позиции (меньший ранг)", () => {
    const fused = reciprocalRankFusion([["top", "mid", "low"]]);
    expect(fused[0]!.score).toBeGreaterThan(fused[1]!.score);
    expect(fused[1]!.score).toBeGreaterThan(fused[2]!.score);
  });
});
