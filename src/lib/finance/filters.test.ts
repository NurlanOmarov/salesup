import { describe, expect, it } from "vitest";
import { incomeWhere } from "./filters";

describe("отбор строк журнала доходов", () => {
  it("пустой отбор ничего не ограничивает", () => {
    expect(incomeWhere({})).toEqual({});
  });

  it("год превращается в границы года по UTC", () => {
    const where = incomeWhere({ year: 2026 });
    expect(where.receivedAt).toEqual({
      gte: new Date("2026-01-01T00:00:00Z"),
      lt: new Date("2027-01-01T00:00:00Z"),
    });
  });

  it("указанный период важнее года — двух правд о периоде не бывает", () => {
    const where = incomeWhere({ year: 2026, from: "2026-09-01", to: "2026-09-30" });
    expect(where.receivedAt).toEqual({
      gte: new Date("2026-09-01T00:00:00Z"),
      lte: new Date("2026-09-30T00:00:00Z"),
    });
  });

  it("одной границы периода достаточно", () => {
    expect(incomeWhere({ from: "2026-09-01" }).receivedAt).toEqual({
      gte: new Date("2026-09-01T00:00:00Z"),
    });
    expect(incomeWhere({ to: "2026-09-30" }).receivedAt).toEqual({
      lte: new Date("2026-09-30T00:00:00Z"),
    });
  });

  it("страна, покупатель и канал складываются в одно условие", () => {
    const where = incomeWhere({ country: "KZ", orgId: "org1", channel: "B2B" });
    expect(where).toMatchObject({ country: "KZ", orgId: "org1", channel: "B2B" });
  });

  it("поиск идёт по компании, пометке покупателя и заметке, без учёта регистра", () => {
    const where = incomeWhere({ q: "  Кухни  " });
    expect(where.OR).toEqual([
      { org: { name: { contains: "Кухни", mode: "insensitive" } } },
      { org: { slug: { contains: "Кухни", mode: "insensitive" } } },
      { buyerRef: { contains: "Кухни", mode: "insensitive" } },
      { note: { contains: "Кухни", mode: "insensitive" } },
    ]);
  });

  it("поиск из одних пробелов условием не становится", () => {
    expect(incomeWhere({ q: "   " }).OR).toBeUndefined();
  });
});
