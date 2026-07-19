import { describe, it, expect } from "vitest";
import {
  convertTiyn,
  buildMultiPrice,
  formatCurrency,
} from "@/lib/currency/format";
import type { RatesMap } from "@/lib/currency/rates";

// Кэш курсов (как от НБ РК): 1 ед. валюты = rate KZT. Приложение пересчитывает
// базовую BYN-цену в KZT/RUB через кросс-курс rates.BYN (1 BYN = X тенге).
const rates: RatesMap = {
  KZT: 1,
  USD: 470.17,
  EUR: 547.47,
  RUB: 6.42, // 1 ₽ = 6.42 ₸
  BYN: 169.35, // 1 Br = 169.35 ₸
};

describe("convertTiyn — база BYN, KZT/RUB — кросс-курс с округлением", () => {
  it("базовая BYN-цена точная (без округления)", () => {
    // 300 Br = 30 000 tiyn
    expect(convertTiyn(30_000, "BYN", rates)).toBe(300);
  });

  it("KZT округляется вверх до 100", () => {
    // 300 Br * 169.35 = 50 805 ₸ → ceil до 100 = 50 900
    expect(convertTiyn(30_000, "KZT", rates)).toBe(50_900);
  });

  it("RUB округляется вверх до 100", () => {
    // 50 805 ₸ / 6.42 = 7 913.55 ₽ → ceil до 100 = 8 000
    expect(convertTiyn(30_000, "RUB", rates)).toBe(8_000);
  });

  it("KZT ceil всегда вверх (не к ближайшему)", () => {
    const v = convertTiyn(30_000, "KZT", rates);
    expect(v % 100).toBe(0);
    expect(v).toBeGreaterThanOrEqual(50_805);
  });

  it("RUB ceil всегда вверх (не к ближайшему)", () => {
    const v = convertTiyn(30_000, "RUB", rates);
    expect(v % 100).toBe(0);
    expect(v).toBeGreaterThanOrEqual(7_913.55);
  });

  it("0 при отсутствии кросс-курса BYN", () => {
    expect(convertTiyn(30_000, "KZT", { KZT: 1 })).toBe(0);
    expect(convertTiyn(30_000, "RUB", { KZT: 1 })).toBe(0);
  });
});

// ru-RU (как в formatCurrency/formatPrice) использует NBSP (U+00A0) как разделитель тысяч.
const NBSP = " ";

describe("formatCurrency / buildMultiPrice", () => {
  it("форматирует BYN с символом Br", () => {
    expect(formatCurrency(30_000, "BYN", rates)).toBe("300 Br");
  });

  it("форматирует KZT с символом ₸", () => {
    expect(formatCurrency(30_000, "KZT", rates)).toBe(`50${NBSP}900 ₸`);
  });

  it("форматирует RUB с символом ₽", () => {
    expect(formatCurrency(30_000, "RUB", rates)).toBe(`8${NBSP}000 ₽`);
  });

  it("возвращает «—» если кросс-курс BYN недоступен", () => {
    expect(formatCurrency(30_000, "KZT", { KZT: 1 })).toBe("—");
  });

  it("buildMultiPrice отдаёт все три валюты", () => {
    const p = buildMultiPrice(30_000, rates);
    expect(p.byn).toBe("300 Br");
    expect(p.kzt).toBe(`50${NBSP}900 ₸`);
    expect(p.rub).toBe(`8${NBSP}000 ₽`);
    expect(p.ready).toBe(true);
  });

  it("buildMultiPrice: ready=false при отсутствии курсов", () => {
    const p = buildMultiPrice(30_000, { KZT: 1 });
    expect(p.ready).toBe(false);
    expect(p.byn).toBe("300 Br");
    expect(p.kzt).toBe("—");
  });
});
