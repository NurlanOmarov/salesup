import { describe, expect, it } from "vitest";
import {
  orgWorkerWelcomeMessage,
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
      orgWorkerWelcomeMessage({
        login: "astrasintez-0001",
        tempPassword: "pw",
        siteUrl: SITE,
        orgName: "АстраСинтез",
      }),
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

  it("сообщение работнику даёт логин, пароль и адрес входа", () => {
    const text = orgWorkerWelcomeMessage({
      login: "astrasintez-0001",
      tempPassword: "hRYA-UhaG",
      siteUrl: SITE,
      orgName: "АстраСинтез",
    });
    expect(text).toContain("https://study.activesales.by/login");
    expect(text).toContain("astrasintez-0001");
    expect(text).toContain("hRYA-UhaG");
    // Временный пароль без предупреждения о смене превращается в постоянный.
    expect(text).toContain("временный после этого перестанет работать");
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

  it("сотрудник видит, от какой компании пришёл доступ", () => {
    // Сообщение приходит из личного чата коллеги: без названия работодателя оно
    // читается как спам, а логин вида acme-0001 ничего не проясняет.
    const worker = orgWorkerWelcomeMessage({
      login: "astrasintez-0001",
      tempPassword: "pw",
      siteUrl: SITE,
      orgName: "АстраСинтез",
    });
    expect(worker).toContain("сотрудника компании «АстраСинтез»");
    expect(worker).toContain("astrasintez-0001");

    // Без наименования первая строка не разваливается: «…кабинету сотрудника
    // для онлайн-обучения…».
    expect(
      orgWorkerWelcomeMessage({ login: "x-0001", tempPassword: "pw", siteUrl: SITE }),
    ).toContain("кабинету сотрудника для онлайн-обучения");
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
