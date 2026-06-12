import { describe, it, expect } from "vitest";
import {
  deviceFingerprint,
  tooManyDevices,
  suspiciousWatch,
  tooManyCities,
  evaluateFlags,
  DEVICE_LIMIT,
} from "./heuristics.js";

describe("deviceFingerprint", () => {
  it("стабилен для одного UA", () => {
    const ua = "Mozilla/5.0 (Macintosh) Chrome/120.0 Safari/537.36";
    expect(deviceFingerprint(ua)).toBe(deviceFingerprint(ua));
  });
  it("игнорирует различие версий (тот же браузер/ОС → тот же отпечаток)", () => {
    const a = deviceFingerprint("Chrome/120.0.1 Mac OS X 14.1");
    const b = deviceFingerprint("Chrome/121.5.9 Mac OS X 14.4");
    expect(a).toBe(b);
  });
  it("разные браузеры → разные отпечатки", () => {
    expect(deviceFingerprint("Chrome Mac")).not.toBe(deviceFingerprint("Firefox Windows"));
  });
  it("32 hex-символа", () => {
    expect(deviceFingerprint("x")).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("tooManyDevices", () => {
  it("в пределах лимита → false", () => {
    expect(tooManyDevices(DEVICE_LIMIT)).toBe(false);
  });
  it("сверх лимита → true", () => {
    expect(tooManyDevices(DEVICE_LIMIT + 1)).toBe(true);
  });
});

describe("suspiciousWatch", () => {
  it("просмотр в 3× длительности и более → подозрительно", () => {
    expect(suspiciousWatch(310, 100)).toBe(true);
  });
  it("нормальный просмотр → нет", () => {
    expect(suspiciousWatch(120, 100)).toBe(false);
  });
  it("неизвестная длительность → нет", () => {
    expect(suspiciousWatch(1000, 0)).toBe(false);
  });
});

describe("tooManyCities", () => {
  it("больше 2 → подозрительно", () => {
    expect(tooManyCities(3)).toBe(true);
    expect(tooManyCities(2)).toBe(false);
  });
});

describe("evaluateFlags", () => {
  it("собирает все сработавшие причины", () => {
    const r = evaluateFlags({ activeDevices: 5, maxWatchedSec: 500, maxLessonDurationSec: 100, distinctCities: 4 });
    expect(r).toEqual(["MANY_DEVICES", "ABNORMAL_WATCH", "MANY_CITIES"]);
  });
  it("норма → пусто", () => {
    expect(evaluateFlags({ activeDevices: 1, maxWatchedSec: 90, maxLessonDurationSec: 100, distinctCities: 1 })).toEqual([]);
  });
});
