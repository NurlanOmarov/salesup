import { describe, expect, it } from "vitest";
import { byn, quoteSeats, SUBSCRIPTION_YEAR_TIYN } from "@/lib/pricing";
import { describeStoredPlan, leadQuote } from "./quote.js";

describe("leadQuote — розница", () => {
  it("берёт цену курса как есть", () => {
    const q = leadQuote({ kind: "B2C", courseTiyn: byn(490) });
    expect(q).toMatchObject({
      plan: "COURSE",
      seats: null,
      totalTiyn: byn(490),
      discount: 0,
      perSeatTiyn: null,
    });
  });

  it("без курса выбора не было — тариф не показываем", () => {
    expect(leadQuote({ kind: "B2C" })).toBeNull();
    expect(leadQuote({ kind: "B2C", courseTiyn: 0 })).toBeNull();
  });
});

describe("leadQuote — корпоратив", () => {
  it("библиотека: считает по годовой подписке и сетке мест", () => {
    const q = leadQuote({ kind: "B2B", plan: "LIBRARY", seats: 20 });
    const expected = quoteSeats(20, SUBSCRIPTION_YEAR_TIYN);
    expect(q).toMatchObject({
      plan: "LIBRARY",
      seats: 20,
      perSeatTiyn: expected.pricePerSeatTiyn,
      totalTiyn: expected.totalTiyn,
      discount: 0.35,
      tierLabel: "Компания",
      belowMinSeats: false,
    });
  });

  it("выбранные курсы: база — их сумма", () => {
    const q = leadQuote({
      kind: "B2B",
      plan: "COURSES",
      seats: 10,
      selectedCoursesTiyn: [byn(490), byn(320)],
    });
    expect(q?.plan).toBe("COURSES");
    expect(q?.retailTiyn).toBe(byn(810));
    expect(q?.discount).toBe(0.25);
  });

  it("если выбранные курсы дороже подписки — считаем по библиотеке", () => {
    const q = leadQuote({
      kind: "B2B",
      plan: "COURSES",
      seats: 10,
      selectedCoursesTiyn: [byn(590), byn(590), byn(590)],
    });
    // Платить больше за меньшее покупатель не должен — то же правило, что в калькуляторе.
    expect(q?.plan).toBe("LIBRARY");
    expect(q?.retailTiyn).toBe(SUBSCRIPTION_YEAR_TIYN);
  });

  it("режим «курсы» без выбранных курсов = библиотека", () => {
    const q = leadQuote({ kind: "B2B", plan: "COURSES", seats: 7, selectedCoursesTiyn: [] });
    expect(q?.plan).toBe("LIBRARY");
  });

  it("мест меньше минимального пакета — без скидки и с пометкой", () => {
    const q = leadQuote({ kind: "B2B", plan: "LIBRARY", seats: 3 });
    expect(q?.discount).toBe(0);
    expect(q?.tierLabel).toBeNull();
    expect(q?.belowMinSeats).toBe(true);
  });

  it("без числа мест расчёта нет", () => {
    expect(leadQuote({ kind: "B2B", plan: "LIBRARY" })).toBeNull();
  });
});

describe("describeStoredPlan", () => {
  it("собирает строку корпоративного расчёта", () => {
    expect(
      describeStoredPlan({
        plan: "LIBRARY",
        seats: 12,
        perSeatTiyn: byn(970),
        totalTiyn: byn(11640),
      }),
      // toLocaleString ставит неразрывный пробел в разряде — берём его же
    ).toBe(`Тариф: вся библиотека на год — 970 Br × 12 = ${(11640).toLocaleString("ru-RU")} Br`);
  });

  it("для розницы показывает цену курса", () => {
    expect(
      describeStoredPlan({ plan: "COURSE", seats: null, perSeatTiyn: null, totalTiyn: byn(490) }),
    ).toBe("Тариф: курс, 490 Br");
  });

  it("для старых заявок без тарифа возвращает null", () => {
    expect(
      describeStoredPlan({ plan: null, seats: 10, perSeatTiyn: null, totalTiyn: null }),
    ).toBeNull();
  });
});
