import { describe, it, expect } from "vitest";
import {
  convertTiyn,
  buildMultiPrice,
  formatCurrency,
} from "@/lib/currency/format";
import type { RatesMap } from "@/lib/currency/rates";

// Кэш курсов (как от НБ РК): 1 ед. валюты = rate KZT.
const rates: RatesMap = {
  KZT: 1,
  USD: 470.17,
  EUR: 547.47,
  RUB: 6.42, // 1 ₽ = 6.42 ₸
  BYN: 169.35, // 1 Br = 169.35 ₸
};

describe("convertTiyn — округление как в transfer-astana", () => {
  it("базовая KZT-цена точная (без округления)", () => {
    // 49 000 ₸ = 4 900 000 tiyn
    expect(convertTiyn(4_900_000, "KZT", rates)).toBe(49_000);
  });

  it("RUB округляется вверх до 100", () => {
    // 49 000 ₸ / 6.42 = 7632.4 ₽ → ceil до 100 = 7700
    expect(convertTiyn(4_900_000, "RUB", rates)).toBe(7700);
  });

  it("BYN округляется вверх до 10", () => {
    // 49 000 ₸ / 169.35 = 289.3 Br → ceil до 10 = 290
    expect(convertTiyn(4_900_000, "BYN", rates)).toBe(290);
  });

  it("RUB ceil всегда вверх (не к ближайшему)", () => {
    // 49 000 / 6.42 = 7632.4 → ближайшая сотня вверх = 7700 (не 7600)
    const v = convertTiyn(4_900_000, "RUB", rates);
    expect(v % 100).toBe(0);
    expect(v).toBeGreaterThanOrEqual(7632.4);
  });

  it("BYN ceil всегда вверх (не к ближайшему)", () => {
    const v = convertTiyn(4_900_000, "BYN", rates);
    expect(v % 10).toBe(0);
    expect(v).toBeGreaterThanOrEqual(289.3);
  });

  it("0 при отсутствии курса", () => {
    expect(convertTiyn(4_900_000, "RUB", { KZT: 1 })).toBe(0);
    expect(convertTiyn(4_900_000, "BYN", { KZT: 1 })).toBe(0);
  });
});

// ru-KZ (как в formatPrice) использует NBSP (U+00A0) как разделитель тысяч.
const NBSP = "\u00A0";

describe("formatCurrency / buildMultiPrice", () => {
  it("форматирует KZT с символом ₸", () => {
    expect(formatCurrency(4_900_000, "KZT", rates)).toBe(`49${NBSP}000 ₸`);
  });

  it("форматирует RUB с символом ₽", () => {
    expect(formatCurrency(4_900_000, "RUB", rates)).toBe(`7${NBSP}700 ₽`);
  });

  it("возвращает «—» если курс недоступен", () => {
    expect(formatCurrency(4_900_000, "RUB", { KZT: 1 })).toBe("—");
  });

  it("buildMultiPrice отдаёт все три валюты", () => {
    const p = buildMultiPrice(4_900_000, rates);
    expect(p.kzt).toBe(`49${NBSP}000 ₸`);
    expect(p.rub).toBe(`7${NBSP}700 ₽`);
    expect(p.byn).toBe("290 Br");
    expect(p.ready).toBe(true);
  });

  it("buildMultiPrice: ready=false при отсутствии курсов", () => {
    const p = buildMultiPrice(4_900_000, { KZT: 1 });
    expect(p.ready).toBe(false);
    expect(p.kzt).toBe(`49${NBSP}000 ₸`);
    expect(p.rub).toBe("—");
  });
});
