import { describe, expect, it } from "vitest";
import {
  passwordChangedEmail,
  passwordResetEmail,
  buyerEmail,
  INLINE_LEARNERS_LIMIT,
  learnersCsv,
  orgCredentialsEmail,
  type OrgLearnerAccess,
} from "./templates";
import { esc } from "./layout";

const SITE = "https://study.activesales.by";

const learner = (n: number): OrgLearnerAccess => ({
  login: `acme-${String(n).padStart(4, "0")}`,
  password: `Pw${n}-abcd-efgh`,
  courses: "Все курсы (3)",
});

const baseOrg = {
  orgName: "ООО «Ромашка»",
  siteUrl: SITE,
  admins: [{ login: "boss@romashka.by", password: "Adm-1234-abcd" }],
  learners: [learner(1), learner(2)],
  learnersAlreadyActive: 0,
  licenses: [{ course: "Кухни 2.0", seats: 2, until: "до 19.09.2027" }],
};

describe("письмо покупателю", () => {
  it("новому ученику: благодарность, логин, временный пароль и ссылка входа — и в тексте, и в HTML", () => {
    const mail = buyerEmail({
      email: "buyer@example.by",
      titles: ["Кухни 2.0"],
      tempPassword: "Kx7-9pTm-q4Rs",
      siteUrl: SITE,
    });
    for (const body of [mail.text, mail.html]) {
      expect(body).toContain("Спасибо за покупку");
      expect(body).toContain("buyer@example.by");
      expect(body).toContain("Kx7-9pTm-q4Rs");
      expect(body).toContain("Кухни 2.0");
      expect(body).toContain(`${SITE}/login`);
    }
    expect(mail.subject).toContain("Доступ к курсу открыт");
  });

  it("существующему ученику пароль не присылает", () => {
    const mail = buyerEmail({
      email: "buyer@example.by",
      titles: ["СПИН-продажи"],
      tempPassword: null,
      siteUrl: SITE,
    });
    expect(mail.text).not.toContain("Временный пароль");
    expect(mail.html).not.toContain("Временный пароль");
    expect(mail.text).toContain("обычным паролем");
  });

  it("несколько курсов — множественное число в теме", () => {
    const mail = buyerEmail({ email: "a@b.by", titles: ["А", "Б"], tempPassword: null, siteUrl: SITE });
    expect(mail.subject).toContain("курсам");
  });

  it("экранирует HTML в названии курса", () => {
    const mail = buyerEmail({
      email: "a@b.by",
      titles: ['<script>alert(1)</script> "Курс"'],
      tempPassword: null,
      siteUrl: SITE,
    });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
  });

  it("подвал со ссылками поддержки: телефон в тексте без дубля", () => {
    const mail = buyerEmail({
      email: "a@b.by",
      titles: ["А"],
      tempPassword: null,
      siteUrl: SITE,
      support: [
        { label: "WhatsApp", href: "https://wa.me/375296053032" },
        { label: "+375 (29) 605-30-32", href: "tel:+375296053032" },
      ],
    });
    expect(mail.text).toContain("WhatsApp: https://wa.me/375296053032");
    expect(mail.text).not.toContain("+375296053032");
    expect(mail.html).toContain('href="tel:+375296053032"');
  });
});

describe("письмо клиенту-организации", () => {
  it("объясняет роли: ответственный и сотрудники — отдельными блоками", () => {
    const mail = orgCredentialsEmail(baseOrg);
    for (const body of [mail.text, mail.html]) {
      expect(body).toMatch(/ответственн/i);
      expect(body).toMatch(/сотрудник/i);
      expect(body).toContain("Кабинет компании");
      expect(body).toContain("Одна учётка — один человек");
    }
    expect(mail.subject).toContain("ООО «Ромашка»");
    // Кавычки в названии не задваиваются.
    expect(mail.subject).not.toContain("««");
    expect(mail.text).not.toContain("«ООО «Ромашка»»");
  });

  it("название без кавычек оборачивается в ёлочки", () => {
    expect(orgCredentialsEmail({ ...baseOrg, orgName: "Ромашка" }).subject).toContain("для «Ромашка»");
  });

  it("содержит логины и пароли и ответственного, и сотрудников", () => {
    const mail = orgCredentialsEmail(baseOrg);
    for (const body of [mail.text, mail.html]) {
      expect(body).toContain("boss@romashka.by");
      expect(body).toContain("Adm-1234-abcd");
      expect(body).toContain("acme-0001");
      expect(body).toContain("Pw1-abcd-efgh");
      expect(body).toContain("acme-0002");
    }
  });

  it("ответственный, уже сменивший пароль, не получает нового — сказано, что прежний", () => {
    const mail = orgCredentialsEmail({
      ...baseOrg,
      admins: [{ login: "boss@romashka.by", password: null }],
    });
    expect(mail.text).toContain("прежний");
    expect(mail.text).not.toContain("Adm-1234-abcd");
  });

  it("много учёток — таблица не раздувает письмо, отсылает ко вложению", () => {
    const many = Array.from({ length: INLINE_LEARNERS_LIMIT + 1 }, (_, i) => learner(i + 1));
    const mail = orgCredentialsEmail({ ...baseOrg, learners: many });
    expect(mail.html).not.toContain("Pw1-abcd-efgh");
    expect(mail.text).not.toContain("Pw1-abcd-efgh");
    expect(mail.html).toContain("во вложении");
    expect(mail.text).toContain("во вложении");
  });

  it("упоминает уже вошедших сотрудников, не включая их пароли", () => {
    const mail = orgCredentialsEmail({ ...baseOrg, learnersAlreadyActive: 4 });
    expect(mail.text).toContain("Ещё 4 сотрудника уже вошли");
  });

  it("предупреждает не пересылать письмо целиком", () => {
    const mail = orgCredentialsEmail(baseOrg);
    expect(mail.text).toContain("не пересылайте его целиком");
  });

  it("не подставляет ФИО-поля: письмо строится только из логинов", () => {
    const mail = orgCredentialsEmail(baseOrg);
    expect(mail.text).toContain("не спрашивает ни ФИО");
  });
});

describe("CSV со списком учёток", () => {
  it("BOM, разделитель «;», экранирование кавычек, колонка под пометки", () => {
    const csv = learnersCsv([{ login: "acme-0001", password: "a;b", courses: 'Курс "А"' }]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"Логин";"Временный пароль";"Курсы";"Кому выдано (заполните сами)"');
    expect(csv).toContain('"acme-0001";"a;b";"Курс ""А""";""');
  });
});

describe("esc", () => {
  it("экранирует спецсимволы HTML и кавычки атрибутов", () => {
    expect(esc(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });
});

describe("письмо восстановления пароля", () => {
  const url = "https://study.activesales.by/reset-password?token=abc_DEF-123";

  it("содержит ссылку, срок действия и предупреждение «не запрашивали — игнорируйте»", () => {
    const mail = passwordResetEmail({ resetUrl: url, ttlMinutes: 60 });
    for (const body of [mail.text, mail.html]) {
      expect(body).toContain(url);
      expect(body).toContain("60 минут");
      expect(body).toContain("проигнорируйте");
    }
    expect(mail.html).toContain(`href="${url}"`);
  });

  it("не подставляет пароль: письмо только со ссылкой", () => {
    const mail = passwordResetEmail({ resetUrl: url, ttlMinutes: 60 });
    expect(mail.text).not.toContain("Временный пароль");
    expect(mail.html).not.toContain("Временный пароль");
  });

  it("уведомление о смене пароля отправляет к поддержке, а не к ссылке", () => {
    const mail = passwordChangedEmail({
      support: [{ label: "WhatsApp", href: "https://wa.me/375296053032" }],
    });
    expect(mail.text).toContain("Если это были не вы");
    expect(mail.text).toContain("https://wa.me/375296053032");
    expect(mail.text).not.toContain("reset-password");
  });
});

describe("подсказки про сброс пароля в письмах", () => {
  it("покупателю — самостоятельно через «Забыли пароль?»", () => {
    const mail = buyerEmail({ email: "a@b.by", titles: ["А"], tempPassword: null, siteUrl: SITE });
    expect(mail.text).toContain("Забыли пароль?");
  });

  it("клиенту-организации: ответственный сбрасывает сам, сотрудникам — только через ответственного", () => {
    const mail = orgCredentialsEmail(baseOrg);
    expect(mail.text).toContain("Забыли пароль?");
    expect(mail.text).toContain("сбросить его может только ответственный");
  });
});
