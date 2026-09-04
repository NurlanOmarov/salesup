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
  it("подписывает BYN словами", () => {
    expect(formatCurrency(30_000, "BYN", rates)).toBe(`300${NBSP}бел.${NBSP}руб.`);
  });

  it("подписывает KZT словами", () => {
    expect(formatCurrency(30_000, "KZT", rates)).toBe(`50${NBSP}900${NBSP}тенге`);
  });

  it("подписывает RUB словами", () => {
    expect(formatCurrency(30_000, "RUB", rates)).toBe(`8${NBSP}000${NBSP}рос.${NBSP}руб.`);
  });

  it("возвращает «—» если кросс-курс BYN недоступен", () => {
    expect(formatCurrency(30_000, "KZT", { KZT: 1 })).toBe("—");
  });

  it("buildMultiPrice отдаёт все три валюты", () => {
    const p = buildMultiPrice(30_000, rates);
    expect(p.byn).toBe(`300${NBSP}бел.${NBSP}руб.`);
    expect(p.kzt).toBe(`50${NBSP}900${NBSP}тенге`);
    expect(p.rub).toBe(`8${NBSP}000${NBSP}рос.${NBSP}руб.`);
    expect(p.ready).toBe(true);
  });

  it("buildMultiPrice: ready=false при отсутствии курсов", () => {
    const p = buildMultiPrice(30_000, { KZT: 1 });
    expect(p.ready).toBe(false);
    expect(p.byn).toBe(`300${NBSP}бел.${NBSP}руб.`);
    expect(p.kzt).toBe("—");
  });
});

describe("buildMultiPrice — валюта страны домена", () => {
  const rates = { BYN: 163.29, RUB: 3.7 } as Record<string, number>;

  it("витрина показывает только валюту своей страны", () => {
    const kz = buildMultiPrice(100_00, rates, "kzt");
    expect(kz.main).toBe(kz.kzt);
    expect(kz.alt).toBe("");

    const uz = buildMultiPrice(100_00, rates, "uzs");
    expect(uz.main).toBe(uz.uzs);
    expect(uz.alt).toBe("");
  });

  it("на белорусской витрине — только белорусский рубль", () => {
    const by = buildMultiPrice(100_00, rates);
    expect(by.main).toBe(by.byn);
    expect(by.alt).toBe("");
  });

  it("по умолчанию — базовая валюта цены (BYN)", () => {
    expect(buildMultiPrice(100_00, rates).main).toBe(buildMultiPrice(100_00, rates).byn);
  });

  it("без курсов откатывается на BYN и не показывает пустых эквивалентов", () => {
    const noRates = buildMultiPrice(100_00, {}, "kzt");
    expect(noRates.main).toBe(noRates.byn);
    expect(noRates.alt).toBe("");
  });
});

describe("перенос строки внутри суммы", () => {
  it("между числом и подписью валюты стоит неразрывный пробел", () => {
    // с обычным пробелом «147 800 тенге» название валюты переносилось на новую строку
    for (const code of ["BYN", "KZT", "RUB"] as const) {
      const value = formatCurrency(30_000, code, rates);
      expect(value).not.toMatch(/\d /);
      expect(value.includes(" ")).toBe(false);
    }
  });
});
