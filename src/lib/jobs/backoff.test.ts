import { describe, it, expect } from "vitest";
import { backoffSec, isExhausted, nextRunAfter, BASE_DELAY_SEC, MAX_DELAY_SEC } from "./backoff.js";

describe("backoffSec", () => {
  it("0 попыток → 0", () => {
    expect(backoffSec(0)).toBe(0);
  });
  it("экспоненциальный рост: 30, 60, 120, 240", () => {
    expect(backoffSec(1)).toBe(30);
    expect(backoffSec(2)).toBe(60);
    expect(backoffSec(3)).toBe(120);
    expect(backoffSec(4)).toBe(240);
  });
  it("упирается в потолок", () => {
    expect(backoffSec(100)).toBe(MAX_DELAY_SEC);
  });
  it("кастомные base/max", () => {
    expect(backoffSec(3, 10, 1000)).toBe(40);
    expect(backoffSec(10, 10, 100)).toBe(100);
  });
  it("BASE и MAX заданы разумно", () => {
    expect(BASE_DELAY_SEC).toBe(30);
    expect(MAX_DELAY_SEC).toBe(1800);
  });
});

describe("isExhausted", () => {
  it("attempts < max → не исчерпано", () => {
    expect(isExhausted(2, 3)).toBe(false);
  });
  it("attempts == max → исчерпано", () => {
    expect(isExhausted(3, 3)).toBe(true);
  });
  it("attempts > max → исчерпано", () => {
    expect(isExhausted(4, 3)).toBe(true);
  });
});

describe("nextRunAfter", () => {
  it("now + backoff", () => {
    const now = new Date("2026-06-12T12:00:00.000Z");
    expect(nextRunAfter(now, 1).toISOString()).toBe("2026-06-12T12:00:30.000Z");
    expect(nextRunAfter(now, 2).toISOString()).toBe("2026-06-12T12:01:00.000Z");
  });
});
