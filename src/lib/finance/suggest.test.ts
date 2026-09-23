import { describe, expect, it } from "vitest";
import { buildIncomeSuggestion, type SuggestLicense } from "./suggest";

/** Курсы НБ РК в том же виде, что отдаёт lib/currency: 1 ед. валюты = X тенге. */
const RATES = { KZT: 1, BYN: 162, RUB: 5.7, UZS: 0.039 };

const license = (over: Partial<SuggestLicense> = {}): SuggestLicense => ({
  courseId: "c1",
  seatsTotal: 10,
  priceTiyn: 44_000, // 440 бел. руб. за место
  coursePriceTiyn: 49_000,
  note: "Счёт №12 от 14.08",
  ...over,
});

describe("предзаполнение поступления от организации", () => {
  it("сумма — места × цена места по счёту, пересчитанная в валюту клиента", () => {
    const s = buildIncomeSuggestion({ site: "KZ", licenses: [license()], rates: RATES });
    expect(s.bynTiyn).toBe(440_000); // 10 × 440 бел. руб.
    expect(s.currency).toBe("KZT");
    expect(s.converted).toBe(true);
    // 4 400 бел. руб. × 162 = 712 800 тенге, округление вверх до сотни.
    expect(s.grossTiyn).toBe(712_800_00);
    expect(s.estimated).toBe(false);
  });

  it("белорусский клиент платит в базовой валюте — без пересчёта", () => {
    const s = buildIncomeSuggestion({ site: "BY", licenses: [license()], rates: RATES });
    expect(s.currency).toBe("BYN");
    expect(s.converted).toBe(false);
    expect(s.grossTiyn).toBe(440_000);
  });

  it("курс проставляется только при единственной лицензии", () => {
    const one = buildIncomeSuggestion({ site: "KZ", licenses: [license()], rates: RATES });
    expect(one.courseId).toBe("c1");

    const many = buildIncomeSuggestion({
      site: "KZ",
      licenses: [license(), license({ courseId: "c2", priceTiyn: 0 })],
      rates: RATES,
    });
    expect(many.courseId).toBeNull();
  });

  it("лицензии библиотеки с нулевой ценой не удваивают сумму", () => {
    // Цена в такой выдаче пишется только в первую лицензию (grantLibraryAction),
    // у остальных priceTiyn = 0 — это ноль, а не «цена не указана».
    const s = buildIncomeSuggestion({
      site: "BY",
      licenses: [
        license({ note: "Библиотека" }),
        license({ courseId: "c2", priceTiyn: 0, note: "Библиотека" }),
        license({ courseId: "c3", priceTiyn: 0, note: "Библиотека" }),
      ],
      rates: RATES,
    });
    expect(s.bynTiyn).toBe(440_000);
    expect(s.estimated).toBe(false);
    expect(s.licenses).toBe(3);
    expect(s.seats).toBe(30);
  });

  it("без записанной цены места сумма считается по сетке и помечается расчётной", () => {
    const s = buildIncomeSuggestion({
      site: "BY",
      licenses: [license({ priceTiyn: null })],
      rates: RATES,
    });
    expect(s.estimated).toBe(true);
    expect(s.grossTiyn).toBeGreaterThan(0);
  });

  it("без лицензий сумма не выдумывается", () => {
    const s = buildIncomeSuggestion({ site: "KZ", licenses: [], rates: RATES });
    expect(s.grossTiyn).toBeNull();
    expect(s.courseId).toBeNull();
  });

  it("без курса НБ РК сумму в валюте клиента подставлять нечем", () => {
    const s = buildIncomeSuggestion({ site: "KZ", licenses: [license()], rates: {} });
    expect(s.grossTiyn).toBeNull();
    expect(s.ratesMissing).toBe(true);
    // Расчёт в базовой валюте при этом остаётся — его видно в подсказке.
    expect(s.bynTiyn).toBe(440_000);
  });

  it("номер счёта из лицензии переезжает в заметку поступления", () => {
    const s = buildIncomeSuggestion({ site: "BY", licenses: [license()], rates: RATES });
    expect(s.note).toBe("Счёт №12 от 14.08");
  });

  it("страна без рынка не ломает форму — остаётся значение по умолчанию", () => {
    const s = buildIncomeSuggestion({ site: null, licenses: [license()], rates: RATES });
    expect(s.country).toBe("KZ");
  });
});
