import { describe, it, expect } from "vitest";
import { normalizeHolderName, validateHolderName, passedVerb, formatCertificateNumber } from "./holder.js";

describe("normalizeHolderName", () => {
  it("убирает лишние пробелы, регистр не трогает", () => {
    expect(normalizeHolderName("  Иванов   Иван\tИванович ")).toBe("Иванов Иван Иванович");
    expect(normalizeHolderName("деЛюка Анна")).toBe("деЛюка Анна");
  });
});

describe("validateHolderName", () => {
  it("принимает ФИО, имя без отчества, дефис и казахские буквы", () => {
    expect(validateHolderName("Иванов Иван Иванович")).toBeNull();
    expect(validateHolderName("Петрова-Водкина Анна")).toBeNull();
    expect(validateHolderName("Омаров Нұрлан Бахытұлы")).toBeNull();
    expect(validateHolderName("O'Neil John")).toBeNull();
  });

  it("отклоняет одно слово, цифры и мусор", () => {
    expect(validateHolderName("Иванов")).toBe("WORDS");
    expect(validateHolderName("Ян")).toBe("TOO_SHORT");
    expect(validateHolderName("Иванов123 Иван")).toBe("CHARS");
    expect(validateHolderName("Иван <b>Иванов</b>")).toBe("CHARS");
    expect(validateHolderName("Иванов Иван Иванович раз два три")).toBe("WORDS");
    expect(validateHolderName("А".repeat(60) + " " + "Б".repeat(60))).toBe("TOO_LONG");
  });
});

describe("passedVerb", () => {
  it("по отчеству", () => {
    expect(passedVerb("Иванов Иван Иванович")).toBe("прошёл");
    expect(passedVerb("Иванова Мария Петровна")).toBe("прошла");
    expect(passedVerb("Сидорова Анна Ильинична")).toBe("прошла");
    expect(passedVerb("Омаров Нурлан Бахытұлы")).toBe("прошёл");
    expect(passedVerb("Касымова Айгерим Ерланқызы")).toBe("прошла");
    expect(passedVerb("Алиева Дильноза Рустам қызы")).toBe("прошла");
  });

  it("без отчества — нейтрально", () => {
    expect(passedVerb("Иванова Мария")).toBe("прошёл(ла)");
    expect(passedVerb("John Smith")).toBe("прошёл(ла)");
  });
});

describe("formatCertificateNumber", () => {
  it("номер/дата по минскому времени, как в образце", () => {
    expect(formatCertificateNumber(5001, new Date("2026-09-22T10:00:00Z"))).toBe("5001/22.09.2026");
    // 22:30 UTC — в Минске уже следующий день
    expect(formatCertificateNumber(5002, new Date("2026-09-22T22:30:00Z"))).toBe("5002/23.09.2026");
  });
});
