import { describe, expect, it } from "vitest";
import {
  BASE_PRICE_TIYN,
  bundlePriceTiyn,
  byn,
  defaultCoursePriceTiyn,
  isPriceWithinRange,
  MIN_B2B_SEATS,
  quoteSeats,
  seatTier,
  SUBSCRIPTION_YEAR_TIYN,
} from "./index";

describe("базовые цены", () => {
  it("отраслевой курс — 490 BYN, общая тема — 320 BYN", () => {
    expect(defaultCoursePriceTiyn("SPECIALIZED")).toBe(49_000);
    expect(defaultCoursePriceTiyn("EVERYONE")).toBe(32_000);
  });

  it("отраслевой дороже общей темы", () => {
    expect(BASE_PRICE_TIYN.SPECIALIZED).toBeGreaterThan(BASE_PRICE_TIYN.EVERYONE);
  });

  it("подписка на год стоит 2,5–3 отраслевых курса", () => {
    const ratio = SUBSCRIPTION_YEAR_TIYN / BASE_PRICE_TIYN.SPECIALIZED;
    expect(ratio).toBeGreaterThanOrEqual(2.5);
    expect(ratio).toBeLessThanOrEqual(3);
  });

  it("коридор цен: 490 и 320 внутри, legacy-цены вне", () => {
    expect(isPriceWithinRange("SPECIALIZED", byn(490))).toBe(true);
    expect(isPriceWithinRange("EVERYONE", byn(320))).toBe(true);
    // 300 BYN — цена старого каталога без AI-практики, для нового продукта низка.
    expect(isPriceWithinRange("SPECIALIZED", byn(300))).toBe(false);
    // 3000 BYN — уровень «профессии», не микрокурса.
    expect(isPriceWithinRange("SPECIALIZED", byn(3000))).toBe(false);
  });
});

describe("bundlePriceTiyn", () => {
  it("пакет «отраслевой + 2 общих» ≈ 1190 BYN", () => {
    const price = bundlePriceTiyn([byn(490), byn(320), byn(320)]);
    // 1130 * 0.83 = 937,9 → округление вниз до 10 BYN
    expect(price).toBe(byn(930));
    expect(price).toBeLessThan(byn(490) + byn(320) + byn(320));
  });

  it("пакет всегда дешевле суммы отдельных цен", () => {
    const parts = [byn(490), byn(490)];
    const sum = parts.reduce((s, p) => s + p, 0);
    expect(bundlePriceTiyn(parts)).toBeLessThan(sum);
  });

  it("пустой пакет стоит ноль", () => {
    expect(bundlePriceTiyn([])).toBe(0);
  });
});

describe("seatTier", () => {
  it("пороги 5 / 10 / 20 дают −15 / −25 / −35 %", () => {
    expect(seatTier(5)?.discount).toBe(0.15);
    expect(seatTier(9)?.discount).toBe(0.15);
    expect(seatTier(10)?.discount).toBe(0.25);
    expect(seatTier(19)?.discount).toBe(0.25);
    expect(seatTier(20)?.discount).toBe(0.35);
    expect(seatTier(100)?.discount).toBe(0.35);
  });

  it("ниже минимального пакета уровня нет — продаём в розницу", () => {
    expect(seatTier(MIN_B2B_SEATS - 1)).toBeNull();
    expect(seatTier(1)).toBeNull();
    expect(seatTier(0)).toBeNull();
  });
});

describe("quoteSeats", () => {
  it("10 мест в библиотеке: ~970 BYN за место", () => {
    const q = quoteSeats(10, SUBSCRIPTION_YEAR_TIYN);
    expect(q.pricePerSeatTiyn).toBe(byn(970));
    expect(q.totalTiyn).toBe(byn(9700));
    expect(q.tier?.label).toBe("Отдел");
  });

  it("20 мест на один отраслевой курс: 320 BYN за место", () => {
    const q = quoteSeats(20, byn(490));
    expect(q.pricePerSeatTiyn).toBe(byn(320));
    expect(q.discount).toBe(0.35);
  });

  it("5 мест — минимальный пакет, −15 %", () => {
    const q = quoteSeats(5, byn(490));
    expect(q.pricePerSeatTiyn).toBe(byn(420));
    expect(q.totalTiyn).toBe(byn(2100));
  });

  it("без скидочного уровня цена равна розничной", () => {
    const q = quoteSeats(3, byn(490));
    expect(q.discount).toBe(0);
    expect(q.pricePerSeatTiyn).toBe(byn(490));
    expect(q.savingTiyn).toBe(0);
  });

  it("экономия растёт с объёмом", () => {
    const small = quoteSeats(5, SUBSCRIPTION_YEAR_TIYN);
    const large = quoteSeats(20, SUBSCRIPTION_YEAR_TIYN);
    expect(large.savingTiyn).toBeGreaterThan(small.savingTiyn);
    expect(large.pricePerSeatTiyn).toBeLessThan(small.pricePerSeatTiyn);
  });

  it("цена места всегда кратна 10 BYN — в КП нет копеек", () => {
    for (const seats of [5, 7, 10, 13, 20, 47]) {
      const q = quoteSeats(seats, SUBSCRIPTION_YEAR_TIYN);
      expect(q.pricePerSeatTiyn % byn(10)).toBe(0);
    }
  });

  it("корпоративное место дешевле розницы, но не бесплатно", () => {
    const q = quoteSeats(50, byn(490));
    expect(q.pricePerSeatTiyn).toBeLessThan(byn(490));
    expect(q.pricePerSeatTiyn).toBeGreaterThan(byn(300));
  });
});
