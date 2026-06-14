import { describe, it, expect } from "vitest";
import { computeExpiry, addMonths } from "./enrollment.js";

const FROM = new Date("2026-01-15T10:00:00.000Z");

describe("computeExpiry", () => {
  it("LIFETIME → null (бессрочно)", () => {
    expect(computeExpiry("LIFETIME", FROM)).toBeNull();
  });

  it("MONTHS_1 → +1 месяц", () => {
    expect(computeExpiry("MONTHS_1", FROM)?.toISOString()).toBe("2026-02-15T10:00:00.000Z");
  });

  it("MONTHS_3 → +3 месяца", () => {
    expect(computeExpiry("MONTHS_3", FROM)?.toISOString()).toBe("2026-04-15T10:00:00.000Z");
  });

  it("MONTHS_6 → +6 месяцев", () => {
    expect(computeExpiry("MONTHS_6", FROM)?.toISOString()).toBe("2026-07-15T10:00:00.000Z");
  });

  it("MONTHS_12 → +12 месяцев", () => {
    expect(computeExpiry("MONTHS_12", FROM)?.toISOString()).toBe("2027-01-15T10:00:00.000Z");
  });
});

describe("addMonths", () => {
  it("обычный случай", () => {
    expect(addMonths(new Date("2026-03-10"), 2).toISOString().slice(0, 10)).toBe("2026-05-10");
  });

  it("переполнение дня: 31 января + 1 месяц → конец февраля", () => {
    const r = addMonths(new Date("2026-01-31"), 1);
    expect(r.getMonth()).toBe(1); // февраль
    expect([28, 29]).toContain(r.getDate());
  });

  it("переход через год", () => {
    expect(addMonths(new Date("2026-11-15"), 3).toISOString().slice(0, 10)).toBe("2027-02-15");
  });
});
