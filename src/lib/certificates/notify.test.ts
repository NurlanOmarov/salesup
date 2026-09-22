import { describe, it, expect } from "vitest";
import { certificateReadyTelegramText, reviewTelegramText, certificateTelegramButtons } from "./notify.js";

const retail = { email: "a@b.by", login: null, orgName: null };
const org = { email: null, login: "keramir-0001", orgName: "Керамир <ООО>" };

describe("certificateReadyTelegramText", () => {
  it("розница — по e-mail, с баллом экзамена", () => {
    const t = certificateReadyTelegramText({ courseTitle: "DIY", scorePct: 92, learner: retail });
    expect(t).toContain("Сертификат готов к выдаче");
    expect(t).toContain("экзамен 92%");
    expect(t).toContain("<code>a@b.by</code>");
  });

  it("работник организации — по логину, название экранировано", () => {
    const t = certificateReadyTelegramText({ courseTitle: "DIY", scorePct: null, learner: org });
    expect(t).toContain("Керамир &lt;ООО&gt;");
    expect(t).toContain("<code>keramir-0001</code>");
    expect(t).not.toContain("экзамен");
  });
});

describe("reviewTelegramText", () => {
  it("звёзды, экранирование и следующий шаг розницы", () => {
    const t = reviewTelegramText({ courseTitle: "DIY", rating: 4, text: "<b>класс</b>", published: true, learner: retail });
    expect(t).toContain("★★★★☆");
    expect(t).toContain("&lt;b&gt;класс&lt;/b&gt;");
    expect(t).toContain("Опубликован");
    expect(t).toContain("письмо с ФИО");
  });

  it("для работника организации — запрос через ответственного; длинный текст обрезан", () => {
    const t = reviewTelegramText({ courseTitle: "DIY", rating: 5, text: "а".repeat(1000), published: false, learner: org });
    expect(t).toContain("ответственный представитель");
    expect(t).toContain("…");
    expect(t.length).toBeLessThan(700);
  });
});

describe("certificateTelegramButtons", () => {
  it("кнопка в админку только при известном адресе сайта", () => {
    expect(certificateTelegramButtons()).toEqual([]);
    expect(certificateTelegramButtons("https://x.by/")[0]![0]!.url).toBe("https://x.by/admin/certificates");
  });
});
