import { describe, expect, it } from "vitest";
import { applicantLeadEmail, contactEmail, leadTelegramText, ownerLeadEmail } from "./notify.js";
import { leadQuote } from "./quote.js";

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

describe("leadTelegramText", () => {
  it("собирает карточку заявки со ссылкой на админку", () => {
    const text = leadTelegramText(
      { ...base, name: "Иван", courseTitle: "Продажи в аптеке", message: "перезвоните вечером" },
      "https://example.by/",
    );
    expect(text).toContain("Новая заявка на курс");
    expect(text).toContain("Продажи в аптеке");
    expect(text).toContain("<code>student@example.com</code>");
    expect(text).toContain("перезвоните вечером");
    expect(text).toContain("https://example.by/admin/leads");
  });

  it("для B2B показывает организацию и число мест", () => {
    const text = leadTelegramText({
      ...base,
      kind: "B2B",
      contact: "+375291234567",
      company: "ООО Ромашка",
      seatsWanted: 25,
    });
    expect(text).toContain("Новая B2B-заявка");
    expect(text).toContain("ООО Ромашка");
    expect(text).toContain("Мест: 25");
  });

  it("экранирует ввод, чтобы не сломать HTML-разметку Telegram", () => {
    const text = leadTelegramText({ ...base, name: "<b>Иван</b> & Co" });
    expect(text).toContain("&lt;b&gt;Иван&lt;/b&gt; &amp; Co");
    // Единственный <b> в сообщении — наш заголовок.
    expect(text.match(/<b>/g)).toHaveLength(1);
  });

  it("показывает выбранный тариф и расчёт по местам", () => {
    const text = leadTelegramText({
      ...base,
      kind: "B2B",
      seatsWanted: 20,
      quote: leadQuote({ kind: "B2B", plan: "LIBRARY", seats: 20 }),
    });
    expect(text).toContain("Тариф: вся библиотека на год");
    expect(text).toContain("× 20 =");
    expect(text).toContain("«Компания», −35%");
  });

  it("предупреждает, когда мест меньше минимального пакета", () => {
    const text = leadTelegramText({
      ...base,
      kind: "B2B",
      seatsWanted: 3,
      quote: leadQuote({ kind: "B2B", plan: "LIBRARY", seats: 3 }),
    });
    expect(text).toContain("Мест меньше минимального пакета");
  });

  it("для розницы показывает цену выбранного курса", () => {
    const text = leadTelegramText({
      ...base,
      courseTitle: "Продажи в аптеке",
      quote: leadQuote({ kind: "B2C", courseTiyn: 49000 }),
    });
    expect(text).toContain("Тариф: курс, 490\u00A0Br");
  });

  it("не печатает пустые поля", () => {
    const text = leadTelegramText({ ...base, name: null, message: null });
    expect(text).not.toContain("Тариф");
    expect(text).not.toContain("Имя");
    expect(text).not.toContain("Сообщение");
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
