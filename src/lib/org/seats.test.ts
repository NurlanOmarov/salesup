import { describe, expect, it } from "vitest";
import {
  computeSeatExpiry,
  computeSeatUsage,
  formatLogin,
  hasFreeSeat,
  slugifyOrgName,
} from "./seats";

describe("computeSeatUsage", () => {
  it("считает свободные места и утилизацию", () => {
    const usage = computeSeatUsage({ seatsTotal: 10, activeEnrollments: 4 });
    expect(usage).toEqual({ total: 10, used: 4, free: 6, utilization: 0.4 });
  });

  it("не уходит в минус, если мест выдано больше, чем куплено", () => {
    const usage = computeSeatUsage({ seatsTotal: 3, activeEnrollments: 5 });
    expect(usage.free).toBe(0);
    expect(usage.utilization).toBe(1);
    expect(hasFreeSeat(usage)).toBe(false);
  });

  it("лицензия без мест не делит на ноль", () => {
    expect(computeSeatUsage({ seatsTotal: 0, activeEnrollments: 0 }).utilization).toBe(0);
  });
});

describe("computeSeatExpiry", () => {
  const from = new Date("2026-01-15T10:00:00Z");

  it("берёт срок места, если лицензия бессрочная", () => {
    const got = computeSeatExpiry({
      accessDuration: "MONTHS_3",
      licenseExpiresAt: null,
      from,
    });
    expect(got?.toISOString().slice(0, 10)).toBe("2026-04-15");
  });

  it("доступ работника не переживает лицензию", () => {
    const licenseEnd = new Date("2026-02-01T00:00:00Z");
    const got = computeSeatExpiry({
      accessDuration: "MONTHS_12",
      licenseExpiresAt: licenseEnd,
      from,
    });
    expect(got).toEqual(licenseEnd);
  });

  it("бессрочное место в срочной лицензии заканчивается вместе с ней", () => {
    const licenseEnd = new Date("2026-06-01T00:00:00Z");
    expect(
      computeSeatExpiry({
        accessDuration: "LIFETIME",
        licenseExpiresAt: licenseEnd,
        from,
      }),
    ).toEqual(licenseEnd);
  });

  it("бессрочное место в бессрочной лицензии не истекает", () => {
    expect(
      computeSeatExpiry({
        accessDuration: "LIFETIME",
        licenseExpiresAt: null,
        from,
      }),
    ).toBeNull();
  });
});

describe("formatLogin", () => {
  it("дополняет номер нулями до четырёх знаков", () => {
    expect(formatLogin("acme", 1)).toBe("acme-0001");
    expect(formatLogin("acme", 42)).toBe("acme-0042");
  });

  it("не обрезает номера свыше 9999", () => {
    expect(formatLogin("acme", 12345)).toBe("acme-12345");
  });

  it("логины уникальны, пока уникален номер", () => {
    const logins = new Set(
      Array.from({ length: 500 }, (_, i) => formatLogin("acme", i + 1)),
    );
    expect(logins.size).toBe(500);
  });
});

describe("slugifyOrgName", () => {
  it("транслитерирует кириллицу — логин должен набираться с любой раскладки", () => {
    expect(slugifyOrgName("Фарм Дистрибьютор")).toBe("farm-distribyutor");
  });

  it("схлопывает разделители и обрезает края", () => {
    expect(slugifyOrgName('ООО «Ромашка»  ')).toBe("ooo-romashka");
  });

  it("ограничивает длину", () => {
    expect(slugifyOrgName("a".repeat(60)).length).toBeLessThanOrEqual(24);
  });

  it("оставляет только допустимые в логине символы", () => {
    expect(slugifyOrgName("Acme #1 & Co.")).toMatch(/^[a-z0-9-]+$/);
  });
});
