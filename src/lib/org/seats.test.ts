import { describe, expect, it } from "vitest";
import {
  computeSeatExpiry,
  computeSeatUsage,
  formatInviteCode,
  formatLogin,
  hasFreeSeat,
  INVITE_ALPHABET,
  INVITE_CODE_LENGTH,
  isInviteUsable,
  normalizeInviteCode,
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

describe("formatInviteCode", () => {
  it("даёт код нужной длины из безопасного алфавита", () => {
    const code = formatInviteCode(Uint8Array.from({ length: 8 }, (_, i) => i * 7));
    expect(code).toHaveLength(INVITE_CODE_LENGTH);
    for (const ch of code) expect(INVITE_ALPHABET).toContain(ch);
  });

  it("в алфавите нет символов, которые путают при переписывании", () => {
    for (const ch of "01OIL") expect(INVITE_ALPHABET).not.toContain(ch);
  });

  it("не падает на коротком буфере", () => {
    expect(formatInviteCode(new Uint8Array(2))).toHaveLength(INVITE_CODE_LENGTH);
  });
});

describe("normalizeInviteCode", () => {
  it("не различает регистр, пробелы и дефисы", () => {
    expect(normalizeInviteCode(" abcd-2345 ")).toBe("ABCD2345");
    expect(normalizeInviteCode("AB CD 23 45")).toBe("ABCD2345");
  });
});

describe("isInviteUsable", () => {
  const now = new Date("2026-08-14T12:00:00Z");
  const base = { maxUses: 1, usedCount: 0, expiresAt: null, revokedAt: null };

  it("свежий код годен", () => {
    expect(isInviteUsable(base, now)).toBe(true);
  });

  it("использованный одноразовый код не годен", () => {
    expect(isInviteUsable({ ...base, usedCount: 1 }, now)).toBe(false);
  });

  it("многоразовый код годен, пока есть остаток", () => {
    expect(isInviteUsable({ ...base, maxUses: 5, usedCount: 4 }, now)).toBe(true);
    expect(isInviteUsable({ ...base, maxUses: 5, usedCount: 5 }, now)).toBe(false);
  });

  it("истёкший и отозванный коды не годны", () => {
    expect(
      isInviteUsable({ ...base, expiresAt: new Date("2026-08-14T11:59:00Z") }, now),
    ).toBe(false);
    expect(isInviteUsable({ ...base, revokedAt: now }, now)).toBe(false);
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
