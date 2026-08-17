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
  volumeTier,
  formatDuration,
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

describe("ступени объёма", () => {
  it("границы 1 и 3 часа определяют ступень", () => {
    expect(volumeTier(39 * 60).key).toBe("express"); // медпреды — 39 минут
    expect(volumeTier(3599).key).toBe("express");
    expect(volumeTier(3600).key).toBe("standard"); // ровно час — уже стандарт
    expect(volumeTier(2 * 3600).key).toBe("standard");
    expect(volumeTier(3 * 3600).key).toBe("extended");
    expect(volumeTier(5 * 3600 + 51 * 60).key).toBe("extended"); // кухни
  });

  it("курс без видео считается стандартным, а не бесплатным", () => {
    // Каркас «в разработке»: цена пересчитается, когда фабрика зальёт уроки.
    expect(volumeTier(null).key).toBe("standard");
    expect(volumeTier(0).key).toBe("standard");
    expect(defaultCoursePriceTiyn("SPECIALIZED", null)).toBe(byn(490));
  });

  it("цена растёт с объёмом, но не пропорционально часам", () => {
    const express = defaultCoursePriceTiyn("SPECIALIZED", 40 * 60);
    const standard = defaultCoursePriceTiyn("SPECIALIZED", 2 * 3600);
    const extended = defaultCoursePriceTiyn("SPECIALIZED", 6 * 3600);

    expect(express).toBe(byn(350));
    expect(standard).toBe(byn(490));
    expect(extended).toBe(byn(590));

    // Девятикратная разница в длительности даёт менее чем двукратную в цене:
    // AI-практика собирается на любой курс независимо от его длины.
    expect(extended / express).toBeLessThan(2);
  });

  it("отраслевой дороже общей темы на каждой ступени", () => {
    for (const seconds of [30 * 60, 2 * 3600, 8 * 3600]) {
      expect(defaultCoursePriceTiyn("SPECIALIZED", seconds)).toBeGreaterThan(
        defaultCoursePriceTiyn("EVERYONE", seconds),
      );
    }
  });

  it("коридор считается по фактическому объёму курса", () => {
    // 350 корректно для 40-минутного курса и мало для шестичасового.
    expect(isPriceWithinRange("SPECIALIZED", byn(350), 40 * 60)).toBe(true);
    expect(isPriceWithinRange("SPECIALIZED", byn(350), 6 * 3600)).toBe(false);
    // 490 велика для экспресса — ровно тот случай, который и надо было поймать.
    expect(isPriceWithinRange("SPECIALIZED", byn(490), 40 * 60)).toBe(false);
  });

  it("ступени не пересекаются и покрывают всю шкалу", () => {
    const keys = [0, 1, 3599, 3600, 10_799, 10_800, 100_000].map(
      (s) => volumeTier(s).key,
    );
    expect(keys).toEqual([
      "standard", // 0 — видео нет
      "express",
      "express",
      "standard",
      "standard",
      "extended",
      "extended",
    ]);
  });
});

describe("formatDuration", () => {
  it("человекочитаемая подпись объёма", () => {
    expect(formatDuration(39 * 60)).toBe("39 мин");
    expect(formatDuration(3600)).toBe("1 ч");
    expect(formatDuration(5 * 3600 + 51 * 60)).toBe("5 ч 51 мин");
    expect(formatDuration(null)).toBe("нет видео");
    expect(formatDuration(0)).toBe("нет видео");
  });
});
