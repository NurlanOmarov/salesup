import { describe, expect, it } from "vitest";
import { byn } from "./index";
import { promoActive, promoEndsAt, PROMO, salePrice, saleTiyn } from "./promo";

const during = new Date(Date.parse(PROMO.startsAt) + 24 * 3600 * 1000);
const after = new Date(Date.parse(PROMO.endsAt) + 1000);
const before = new Date(Date.parse(PROMO.startsAt) - 1000);

describe("акция −50 %", () => {
  it("идёт между началом и концом", () => {
    expect(promoActive(during)).toBe(true);
    expect(promoActive(before)).toBe(false);
    expect(promoActive(after)).toBe(false);
  });

  it("режет цену пополам и отдаёт старую для зачёркивания", () => {
    const sale = salePrice(byn(590), during);
    expect(sale.tiyn).toBe(byn(295));
    expect(sale.oldTiyn).toBe(byn(590));
    expect(sale.percent).toBe(50);
  });

  it("округляет до целого рубля: 345 Br, а не 345,00", () => {
    expect(saleTiyn(byn(691), during) % 100).toBe(0);
  });

  it("после окончания витрина сама возвращается к полной цене", () => {
    const sale = salePrice(byn(590), after);
    expect(sale.tiyn).toBe(byn(590));
    expect(sale.oldTiyn).toBeNull();
  });

  it("нулевую цену (курс без прайса) не трогает", () => {
    expect(salePrice(0, during)).toEqual({ tiyn: 0, oldTiyn: null, percent: 0 });
  });

  it("дата окончания разбирается корректно", () => {
    expect(promoEndsAt().getTime()).toBe(Date.parse(PROMO.endsAt));
  });
});
