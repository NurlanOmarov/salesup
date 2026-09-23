import { describe, expect, it } from "vitest";
import {
  convertTiyn,
  convertedAmounts,
  fxFromRates,
  needsFreshFx,
  resolveFx,
  EMPTY_FX,
} from "./fx";

/** «1 ед. валюты = X тенге», как отдаёт НБ РК. */
const RATES = { KZT: 1, BYN: 162.29, RUB: 5.7, UZS: 0.039 };
const FX_KZT = fxFromRates("KZT", RATES);
const FX_BYN = fxFromRates("BYN", RATES);

describe("две валюты в журнале доходов", () => {
  it("тенговое поступление показывается ещё и в бел. рублях", () => {
    // 44 000 тенге / 162,29 = 271,12 бел. руб.
    expect(convertTiyn(44_000_00, "KZT", "BYN", FX_KZT)).toBe(271_12);
    expect(convertTiyn(44_000_00, "KZT", "KZT", FX_KZT)).toBe(44_000_00);
  });

  it("белорусское поступление показывается ещё и в тенге", () => {
    // 885 бел. руб. × 162,29 = 143 626,65 тенге
    expect(convertTiyn(885_00, "BYN", "KZT", FX_BYN)).toBe(143_626_65);
  });

  it("рублёвое поступление переводится в обе валюты журнала", () => {
    const fx = fxFromRates("RUB", RATES);
    const both = convertedAmounts(10_000_00, "RUB", fx);
    expect(both.map((a) => a.currency)).toEqual(["KZT", "BYN"]);
    expect(both[0]?.tiyn).toBe(57_000_00); // 10 000 × 5,7
    expect(both[1]?.tiyn).toBe(351_22); // 57 000 / 162,29
  });

  it("своя валюта в пересчёт не попадает — дублировать строку незачем", () => {
    expect(convertedAmounts(44_000_00, "KZT", FX_KZT)).toEqual([
      { currency: "BYN", tiyn: 271_12 },
    ]);
  });

  it("без курса пересчёт не выдумывается", () => {
    expect(convertTiyn(44_000_00, "KZT", "BYN", EMPTY_FX)).toBeNull();
    expect(convertedAmounts(44_000_00, "KZT", EMPTY_FX)).toEqual([]);
    expect(fxFromRates("BYN", {}).kztPerBynMicro).toBeNull();
  });

  it("курс записи важнее сегодняшнего; без записанного — сегодняшний с пометкой", () => {
    const stored = { kztPerUnitMicro: 1_000_000, kztPerBynMicro: 150_000_000 };
    const resolved = resolveFx(stored, FX_KZT);
    expect(resolved.fx).toBe(stored);
    expect(resolved.approximate).toBe(false);

    const old = resolveFx(EMPTY_FX, FX_KZT);
    expect(old.fx).toBe(FX_KZT);
    expect(old.approximate).toBe(true);
  });

  it("правка записи курс не пересчитывает — кроме смены валюты и пустого курса", () => {
    const stored = { currency: "KZT", kztPerUnitMicro: 1_000_000, kztPerBynMicro: 162_290_000 };
    // Дописали заметку, поправили дату — курс дня остаётся прежним.
    expect(needsFreshFx(stored, "KZT")).toBe(false);
    // Валюта другая — старый курс относился к тенге и теперь врёт.
    expect(needsFreshFx(stored, "BYN")).toBe(true);
    // Старая запись без курса: свежий лучше, чем никакого.
    expect(needsFreshFx({ currency: "KZT", ...EMPTY_FX }, "KZT")).toBe(true);
  });

  it("половинчатый снимок курса считается отсутствующим", () => {
    // Курс валюты есть, курса рубля нет — в бел. рубли такую строку не перевести.
    const half = { kztPerUnitMicro: 1_000_000, kztPerBynMicro: null };
    expect(resolveFx(half, FX_KZT).approximate).toBe(true);
  });
});
