import { describe, expect, it } from "vitest";
import { generateResetToken, hashResetToken, resetIdentifier } from "./password-reset";

describe("токен сброса пароля", () => {
  it("случайный, url-safe и длинный: 256 бит", () => {
    const a = generateResetToken();
    const b = generateResetToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("в базу уходит хеш, а не сам токен", () => {
    const raw = generateResetToken();
    const hashed = hashResetToken(raw);
    expect(hashed).toMatch(/^[0-9a-f]{64}$/);
    expect(hashed).not.toContain(raw);
    expect(hashResetToken(raw)).toBe(hashed);
  });

  it("идентификатор не зависит от регистра и пробелов в адресе", () => {
    expect(resetIdentifier("  Ivan@Example.BY ")).toBe("pwreset:ivan@example.by");
  });
});
