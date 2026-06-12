import { describe, it, expect } from "vitest";
import {
  signSegment,
  verifySegment,
  segmentExpiry,
  SEGMENT_TTL_SEC,
} from "./signing.js";

const SECRET = "video-signing-secret-0123456789abcdef";
const USER = "user_abc";
const KEY = "courses/sales-pharma/lessons/l1/720p/seg_0000.ts";
const NOW = 1_800_000_000;
const EXP = NOW + 100;

describe("signSegment / verifySegment", () => {
  it("валидная подпись проходит", () => {
    const sig = signSegment(USER, KEY, EXP, SECRET);
    expect(
      verifySegment({ userId: USER, key: KEY, expSec: EXP, sig, secret: SECRET, nowSec: NOW }),
    ).toBeNull();
  });

  it("истёкшая подпись → EXPIRED", () => {
    const exp = NOW - 1;
    const sig = signSegment(USER, KEY, exp, SECRET);
    expect(
      verifySegment({ userId: USER, key: KEY, expSec: exp, sig, secret: SECRET, nowSec: NOW }),
    ).toBe("EXPIRED");
  });

  it("ровно на границе exp == now → ещё валидна", () => {
    const sig = signSegment(USER, KEY, NOW, SECRET);
    expect(
      verifySegment({ userId: USER, key: KEY, expSec: NOW, sig, secret: SECRET, nowSec: NOW }),
    ).toBeNull();
  });

  it("чужой userId → BAD_SIGNATURE (нельзя расшарить ссылку)", () => {
    const sig = signSegment(USER, KEY, EXP, SECRET);
    expect(
      verifySegment({ userId: "other", key: KEY, expSec: EXP, sig, secret: SECRET, nowSec: NOW }),
    ).toBe("BAD_SIGNATURE");
  });

  it("другой key (подмена сегмента) → BAD_SIGNATURE", () => {
    const sig = signSegment(USER, KEY, EXP, SECRET);
    expect(
      verifySegment({
        userId: USER,
        key: "courses/other/lessons/x/720p/seg_0000.ts",
        expSec: EXP,
        sig,
        secret: SECRET,
        nowSec: NOW,
      }),
    ).toBe("BAD_SIGNATURE");
  });

  it("подмена exp (продление срока) → BAD_SIGNATURE", () => {
    const sig = signSegment(USER, KEY, EXP, SECRET);
    expect(
      verifySegment({ userId: USER, key: KEY, expSec: EXP + 9999, sig, secret: SECRET, nowSec: NOW }),
    ).toBe("BAD_SIGNATURE");
  });

  it("другой секрет → BAD_SIGNATURE", () => {
    const sig = signSegment(USER, KEY, EXP, "wrong-secret-wrong-secret-xxxxxxxx");
    expect(
      verifySegment({ userId: USER, key: KEY, expSec: EXP, sig, secret: SECRET, nowSec: NOW }),
    ).toBe("BAD_SIGNATURE");
  });

  it("мусорная подпись не той длины → BAD_SIGNATURE (без исключения)", () => {
    expect(
      verifySegment({ userId: USER, key: KEY, expSec: EXP, sig: "deadbeef", secret: SECRET, nowSec: NOW }),
    ).toBe("BAD_SIGNATURE");
  });

  it("подпись детерминирована для одних входов", () => {
    expect(signSegment(USER, KEY, EXP, SECRET)).toBe(signSegment(USER, KEY, EXP, SECRET));
  });
});

describe("segmentExpiry", () => {
  it("по умолчанию now + 4 часа", () => {
    expect(segmentExpiry(NOW)).toBe(NOW + SEGMENT_TTL_SEC);
    expect(SEGMENT_TTL_SEC).toBe(14400);
  });

  it("кастомный TTL", () => {
    expect(segmentExpiry(NOW, 60)).toBe(NOW + 60);
  });
});
