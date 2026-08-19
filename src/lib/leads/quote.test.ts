import { describe, expect, it } from "vitest";
import { byn, quoteSeats } from "@/lib/pricing";
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
  it("считает по сумме выбранных курсов и сетке мест", () => {
    const q = leadQuote({
      kind: "B2B",
      seats: 20,
      selectedCoursesTiyn: [byn(350), byn(250)],
    });
    const expected = quoteSeats(20, byn(600));
    expect(q).toMatchObject({
      plan: "COURSES",
      seats: 20,
      retailTiyn: byn(600),
      perSeatTiyn: expected.pricePerSeatTiyn,
      totalTiyn: expected.totalTiyn,
      discount: 0.35,
      tierLabel: "Компания",
      belowMinSeats: false,
    });
  });

  it("набор «отрасль + общие»: база — сумма всех его курсов", () => {
    const q = leadQuote({
      kind: "B2B",
      seats: 10,
      selectedCoursesTiyn: [byn(490), byn(320)],
    });
    expect(q?.plan).toBe("COURSES");
    expect(q?.retailTiyn).toBe(byn(810));
    expect(q?.discount).toBe(0.25);
  });

  it("дорогой набор не подменяется библиотекой — её больше не продаём", () => {
    const q = leadQuote({
      kind: "B2B",
      seats: 10,
      selectedCoursesTiyn: [byn(590), byn(590), byn(590)],
    });
    expect(q?.plan).toBe("COURSES");
    expect(q?.retailTiyn).toBe(byn(1770));
  });

  it("без выбранных курсов считать не по чему", () => {
    expect(leadQuote({ kind: "B2B", seats: 7, selectedCoursesTiyn: [] })).toBeNull();
    expect(leadQuote({ kind: "B2B", seats: 7 })).toBeNull();
  });

  it("мест меньше минимального пакета — без скидки и с пометкой", () => {
    const q = leadQuote({ kind: "B2B", seats: 3, selectedCoursesTiyn: [byn(600)] });
    expect(q?.discount).toBe(0);
    expect(q?.tierLabel).toBeNull();
    expect(q?.belowMinSeats).toBe(true);
  });

  it("без числа мест расчёта нет", () => {
    expect(leadQuote({ kind: "B2B", selectedCoursesTiyn: [byn(600)] })).toBeNull();
  });
});

describe("describeStoredPlan", () => {
  it("читает старые заявки с тарифом «вся библиотека»", () => {
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
