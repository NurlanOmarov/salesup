import { describe, it, expect } from "vitest";
import { certificateReadyTelegramText, reviewTelegramText, certificateTelegramButtons, certificateIssuedTelegramText, certificateEmail } from "./notify.js";

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
    expect(t).toContain("ввести ФИО");
  });

  it("длинный текст обрезан", () => {
    const t = reviewTelegramText({ courseTitle: "DIY", rating: 5, text: "а".repeat(1000), published: false, learner: org });
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

describe("certificateIssuedTelegramText / certificateEmail", () => {
  it("B2B: уведомление и письмо ответственному с ФИО и подписью работника", () => {
    expect(certificateIssuedTelegramText({ courseTitle: "DIY", number: "5001/22.09.2026", learner: org })).toContain(
      "ответственному представителю",
    );
    const m = certificateEmail({ to: "hr@k.by", holderName: "Иванов Иван", courseTitle: "DIY", number: "5001/22.09.2026", verifyUrl: "https://x/verify/h", orgName: "Керамир", label: "Кассир-2" });
    expect(m.subject).toContain("5001/22.09.2026");
    expect(m.text).toContain("Работник вашей компании Иванов Иван (Кассир-2)");
    expect(m.text).toContain("https://x/verify/h");
  });

  it("розница: письмо самому ученику", () => {
    const m = certificateEmail({ to: "a@b.by", holderName: "Иванов Иван", courseTitle: "DIY", number: "5001", verifyUrl: "u", orgName: null, label: null });
    expect(m.text).toContain("Поздравляем");
    expect(certificateIssuedTelegramText({ courseTitle: "DIY", number: "5001", learner: retail })).toContain("ученику на почту");
  });
});
