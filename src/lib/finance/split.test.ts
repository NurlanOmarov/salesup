import { describe, expect, it } from "vitest";
import {
  countryLabel,
  isCountry,
  payeeGross,
  splitIncome,
  taxByRate,
} from "./split";

const N = { id: "n", role: "CO_OWNER" as const, shareBp: 2000 };
const V = { id: "v", role: "AUTHOR" as const, shareBp: null };

describe("splitIncome", () => {
  it("Казахстан: 44 000 → налог 5 000, Н. 7 800, В. 31 200", () => {
    const r = splitIncome({
      grossTiyn: 4_400_000,
      rateMilli: 11364,
      currency: "KZT",
      coOwners: [N],
      author: V,
    });
    expect(r.taxTiyn).toBe(500_000);
    expect(r.netTiyn).toBe(3_900_000);
    expect(r.shares).toEqual([
      { payeeId: "n", shareBp: 2000, amountTiyn: 780_000 },
      { payeeId: "v", shareBp: 8000, amountTiyn: 3_120_000 },
    ]);
  });

  it("Беларусь 25%: копейки не теряются, выплаты = чистой", () => {
    const r = splitIncome({
      grossTiyn: 33_333,
      rateMilli: 25000,
      currency: "BYN",
      coOwners: [N],
      author: V,
    });
    expect(r.taxTiyn).toBe(8_333);
    expect(r.netTiyn).toBe(25_000);
    expect(r.shares.reduce((s, l) => s + l.amountTiyn, 0)).toBe(r.netTiyn);
  });

  it("тенге округляются до целых, остаток — автору", () => {
    const r = splitIncome({
      grossTiyn: 1_234_500,
      rateMilli: 11364,
      currency: "KZT",
      coOwners: [N],
      author: V,
    });
    expect(r.taxTiyn % 100).toBe(0);
    expect(r.shares[0]!.amountTiyn % 100).toBe(0);
    expect(r.shares.reduce((s, l) => s + l.amountTiyn, 0)).toBe(r.netTiyn);
  });

  it("налог, поправленный вручную, важнее ставки", () => {
    const r = splitIncome({
      grossTiyn: 4_400_000,
      rateMilli: 11364,
      currency: "KZT",
      coOwners: [N],
      author: V,
      taxTiyn: 440_000,
    });
    expect(r.netTiyn).toBe(3_960_000);
    expect(r.shares[0]!.amountTiyn).toBe(792_000);
  });

  it("отклоняет налог больше суммы и доли больше 100%", () => {
    expect(() =>
      splitIncome({ grossTiyn: 100, rateMilli: 0, currency: "KZT", coOwners: [N], author: V, taxTiyn: 200 }),
    ).toThrow();
    expect(() =>
      splitIncome({
        grossTiyn: 10_000,
        rateMilli: 0,
        currency: "KZT",
        coOwners: [N, { id: "x", role: "CO_OWNER", shareBp: 9000 }],
        author: V,
      }),
    ).toThrow();
  });

  it("taxByRate: 25% от 100 000 рос. руб.", () => {
    expect(taxByRate(10_000_000, 25000, "RUB")).toBe(2_500_000);
  });
});

describe("payeeGross", () => {
  it("Н.: 7 800 чистыми из 39 000 при выручке 44 000 → доход 8 800", () => {
    expect(payeeGross(780_000, 3_900_000, 4_400_000)).toBe(880_000);
    expect(payeeGross(3_120_000, 3_900_000, 4_400_000)).toBe(3_520_000);
  });
});

describe("страны", () => {
  it("страна подписывается флагом — строку журнала видно взглядом", () => {
    expect(countryLabel("KZ")).toBe("🇰🇿 Казахстан");
    expect(countryLabel("BY")).toBe("🇧🇾 Беларусь");
  });

  it("незнакомый код отдаётся как есть — флаг выдумывать нечему", () => {
    expect(countryLabel("DE")).toBe("DE");
    expect(isCountry("DE")).toBe(false);
  });
});
