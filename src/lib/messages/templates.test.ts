import { describe, expect, it } from "vitest";
import {
  inviteMessage,
  orgAdminPasswordMessage,
  orgAdminWelcomeMessage,
  studentPasswordMessage,
  studentWelcomeMessage,
} from "./templates";

const SITE = "https://study.activesales.by/";

describe("шаблоны сообщений о доступе", () => {
  it("не оставляет двойного слэша в адресах", () => {
    const texts = [
      orgAdminWelcomeMessage({
        orgName: "Авеню",
        login: "hr@company.by",
        tempPassword: "hRYA-UhaG-k6xE",
        siteUrl: SITE,
      }),
      studentWelcomeMessage({ login: "a@b.by", tempPassword: "pw", siteUrl: SITE }),
      inviteMessage({ code: "GTXRHYPG", siteUrl: SITE }),
    ];
    for (const t of texts) expect(t).not.toContain("by//");
  });

  it("сообщение ответственному содержит доступ и путь в кабинет", () => {
    const text = orgAdminWelcomeMessage({
      orgName: "Авеню",
      login: "hr@company.by",
      tempPassword: "hRYA-UhaG-k6xE",
      siteUrl: SITE,
    });
    expect(text).toContain("Авеню");
    expect(text).toContain("hr@company.by");
    expect(text).toContain("hRYA-UhaG-k6xE");
    expect(text).toContain("https://study.activesales.by/login");
    expect(text).toContain("Кабинет компании");
  });

  it("сообщение работнику ведёт на /join с кодом и напоминает сохранить логин", () => {
    const text = inviteMessage({ code: "GTXRHYPG", siteUrl: SITE });
    expect(text).toContain("https://study.activesales.by/join");
    expect(text).toContain("GTXRHYPG");
    expect(text).toContain("сохраните его");
    // Обезличивание — обещание оферты, и работник должен видеть его текстом.
    expect(text).toContain("Ни имя, ни почта, ни телефон не запрашиваются");
  });

  it("курсы ученика попадают в сообщение, когда переданы", () => {
    const withCourses = studentWelcomeMessage({
      login: "a@b.by",
      tempPassword: "pw",
      siteUrl: SITE,
      courses: ["Продажи в аптеке", "Работа с возражениями"],
    });
    expect(withCourses).toContain("• Продажи в аптеке");
    expect(withCourses).toContain("Ваши курсы:");

    const without = studentWelcomeMessage({ login: "a@b.by", tempPassword: "pw", siteUrl: SITE });
    expect(without).not.toContain("Ваши курсы:");
  });

  it("сообщения о сбросе предупреждают, что старый пароль не работает", () => {
    for (const text of [
      orgAdminPasswordMessage({ login: "a@b.by", tempPassword: "pw", siteUrl: SITE }),
      studentPasswordMessage({ login: "a@b.by", tempPassword: "pw", siteUrl: SITE }),
    ]) {
      expect(text).toContain("Старый пароль больше не работает");
      expect(text).toContain("pw");
    }
  });
});
