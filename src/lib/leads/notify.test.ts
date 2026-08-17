import { describe, expect, it } from "vitest";
import { applicantLeadEmail, contactEmail, ownerLeadEmail } from "./notify.js";

const base = {
  kind: "B2C" as const,
  contact: "student@example.com",
  createdAt: new Date("2026-08-17T10:00:00.000Z"),
};

describe("contactEmail", () => {
  it("узнаёт e-mail", () => {
    expect(contactEmail("  student@example.com ")).toBe("student@example.com");
  });

  it("не считает телефон и telegram почтой", () => {
    expect(contactEmail("+375291234567")).toBeNull();
    expect(contactEmail("@nurlan")).toBeNull();
    expect(contactEmail("почта: a@b")).toBeNull();
  });
});

describe("ownerLeadEmail", () => {
  it("кладёт контакт и курс в тело письма", () => {
    const mail = ownerLeadEmail("owner@example.com", {
      ...base,
      name: "Иван",
      courseTitle: "Продажи в аптеке",
      message: "перезвоните вечером",
    });
    expect(mail.to).toBe("owner@example.com");
    expect(mail.subject).toContain("Продажи в аптеке");
    expect(mail.text).toContain("student@example.com");
    expect(mail.text).toContain("перезвоните вечером");
    // Отвечать владелец может прямо из письма.
    expect(mail.replyTo).toBe("student@example.com");
  });

  it("для B2B показывает организацию и число мест", () => {
    const mail = ownerLeadEmail("owner@example.com", {
      ...base,
      kind: "B2B",
      contact: "+375291234567",
      company: "ООО Ромашка",
      seatsWanted: 25,
    });
    expect(mail.subject).toContain("ООО Ромашка");
    expect(mail.text).toContain("Мест: 25");
    // Телефон — не адрес для ответа.
    expect(mail.replyTo).toBeUndefined();
  });

  it("не печатает пустые поля", () => {
    const mail = ownerLeadEmail("owner@example.com", { ...base, name: null, message: null });
    expect(mail.text).not.toContain("Имя:");
    expect(mail.text).not.toContain("Сообщение:");
  });
});

describe("applicantLeadEmail", () => {
  it("подтверждает приём заявки с названием курса", () => {
    const mail = applicantLeadEmail("student@example.com", {
      ...base,
      name: "Иван",
      courseTitle: "Продажи в аптеке",
    });
    expect(mail.to).toBe("student@example.com");
    expect(mail.text).toContain("Иван, здравствуйте!");
    expect(mail.text).toContain("«Продажи в аптеке»");
  });

  it("работает без имени и курса", () => {
    const mail = applicantLeadEmail("student@example.com", base);
    expect(mail.text).toContain("Здравствуйте!");
    expect(mail.text).toContain("на обучение");
  });
});
