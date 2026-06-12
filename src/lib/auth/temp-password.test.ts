import { describe, it, expect } from "vitest";
import { generateTempPassword } from "./temp-password.js";

describe("generateTempPassword", () => {
  it("формат: 3 группы по 4 символа через дефис", () => {
    expect(generateTempPassword()).toMatch(/^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/);
  });

  it("не содержит неоднозначных символов 0 O o 1 l I i", () => {
    for (let i = 0; i < 50; i++) {
      const pw = generateTempPassword();
      expect(pw).not.toMatch(/[0Oo1lIi]/);
    }
  });

  it("пароли уникальны (нет коллизий на выборке)", () => {
    const set = new Set(Array.from({ length: 200 }, () => generateTempPassword()));
    expect(set.size).toBe(200);
  });

  it("длина 14 символов (12 + 2 дефиса)", () => {
    expect(generateTempPassword()).toHaveLength(14);
  });
});
