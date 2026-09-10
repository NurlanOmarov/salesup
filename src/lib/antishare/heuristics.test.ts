import { describe, it, expect } from "vitest";
import {
  deviceFingerprint,
  suspiciousWatch,
  tooManyCities,
  evaluateFlags,
  effectiveDeviceLimit,
  resolveDeviceLimit,
  DEVICE_LIMIT,
  DEVICE_FLAG_FROM,
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
  it("безлимит (deviceLimit=null) не флагует по устройствам", () => {
    const r = evaluateFlags({ activeDevices: 9, maxWatchedSec: 0, maxLessonDurationSec: 0, distinctCities: 1, deviceLimit: null });
    expect(r).not.toContain("MANY_DEVICES");
  });
  it("сигнал загорается с порога, а не с каждого второго устройства", () => {
    const below = evaluateFlags({
      activeDevices: DEVICE_FLAG_FROM - 1,
      maxWatchedSec: 0,
      maxLessonDurationSec: 0,
      distinctCities: 1,
    });
    expect(below).not.toContain("MANY_DEVICES");

    const at = evaluateFlags({
      activeDevices: DEVICE_FLAG_FROM,
      maxWatchedSec: 0,
      maxLessonDurationSec: 0,
      distinctCities: 1,
    });
    expect(at).toContain("MANY_DEVICES");
  });

  it("при стандартном лимите сигнал недостижим — столько устройств вход не пустит", () => {
    // Не курьёз, а следствие решения: с двумя разрешёнными устройствами третье
    // не появляется вовсе, и сигнал остаётся для учёток с поднятым лимитом.
    expect(DEVICE_FLAG_FROM).toBeGreaterThan(DEVICE_LIMIT);
  });

  it("поднятый лимит не отключает сигнал: смотреть всё равно есть на что", () => {
    const r = evaluateFlags({
      activeDevices: 4,
      maxWatchedSec: 0,
      maxLessonDurationSec: 0,
      distinctCities: 1,
      deviceLimit: 8,
    });
    expect(r).toContain("MANY_DEVICES");
  });
});

describe("effectiveDeviceLimit", () => {
  it("null → стандартный лимит", () => {
    expect(effectiveDeviceLimit(null)).toBe(DEVICE_LIMIT);
    expect(effectiveDeviceLimit(undefined)).toBe(DEVICE_LIMIT);
  });
  it("0 → безлимит (null)", () => {
    expect(effectiveDeviceLimit(0)).toBeNull();
  });
  it("N>0 → N", () => {
    expect(effectiveDeviceLimit(3)).toBe(3);
  });
});

describe("resolveDeviceLimit", () => {
  it("без настроек — стандартный лимит платформы", () => {
    expect(resolveDeviceLimit(null, null)).toBe(DEVICE_LIMIT);
    expect(resolveDeviceLimit(undefined)).toBe(DEVICE_LIMIT);
  });

  it("работник наследует лимит своей организации", () => {
    expect(resolveDeviceLimit(null, 4)).toBe(4);
    expect(resolveDeviceLimit(null, 0)).toBeNull(); // безлимит на всю компанию
  });

  it("личная настройка сильнее настройки организации", () => {
    expect(resolveDeviceLimit(1, 5)).toBe(1);
    // Личный безлимит остаётся безлимитом даже при строгой настройке компании.
    expect(resolveDeviceLimit(0, 2)).toBeNull();
  });
});
