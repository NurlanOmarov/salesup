import { describe, expect, it } from "vitest";
import { salePrice } from "@/lib/pricing/promo";
import {
  applicantLeadEmail,
  contactEmail,
  leadGreeting,
  leadTelegramButtons,
  leadTelegramText,
  ownerLeadEmail,
} from "./notify.js";
import { byn } from "@/lib/pricing";
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
  it("собирает карточку заявки", () => {
    const text = leadTelegramText({
      ...base,
      name: "Иван",
      courseTitle: "Продажи в аптеке",
      message: "перезвоните вечером",
    });
    expect(text).toContain("Новая заявка на курс");
    expect(text).toContain("Продажи в аптеке");
    expect(text).toContain("<code>student@example.com</code>");
    expect(text).toContain("перезвоните вечером");
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

  it("называет канал связи, а переход в него оставляет кнопке", () => {
    const text = leadTelegramText({
      ...base,
      contact: "+375296053032",
      contactType: "WHATSAPP",
      contactCountry: "BY",
      site: "BY",
      siteHost: "study.activesales.by",
    });
    expect(text).toContain("📞 WhatsApp: <code>+375 29 605 30 32</code>");
    expect(text).not.toContain("<a href");
    expect(text).toContain("🇧🇾 Беларусь");
    expect(text).toContain("🌐 Заявка с домена: 🇧🇾 study.activesales.by");
  });

  it("предупреждает, когда номер не из страны домена", () => {
    // Заход с белорусской витрины с казахстанского номера — обычное дело, но
    // владельцу нужно знать это до звонка (язык, часовой пояс, роуминг).
    const text = leadTelegramText({
      ...base,
      contact: "+77058306028",
      contactType: "WHATSAPP",
      contactCountry: "KZ",
      site: "BY",
      siteHost: "study.activesales.by",
    });
    expect(text).toContain("🌍 Страна номера: 🇰🇿 Казахстан ⚠️ другая страна, чем домен заявки");
    expect(text).toContain("study.activesales.by");
  });

  it("у Viber схему viber:// в текст не пускает — Telegram принимает только http", () => {
    const text = leadTelegramText({
      ...base,
      contact: "+375296053032",
      contactType: "VIBER",
      contactCountry: "BY",
    });
    expect(text).toContain("📞 Viber:");
    expect(text).not.toContain("viber://");
  });
});

describe("leadTelegramButtons", () => {
  it("даёт кнопку в мессенджер клиента с готовым первым сообщением", () => {
    const [chat, admin] = leadTelegramButtons(
      {
        ...base,
        name: "Иван",
        contact: "+375296053032",
        contactType: "WHATSAPP",
        courseTitle: "Продажи в аптеке",
      },
      "https://example.by/",
    );
    expect(chat?.[0]?.text).toBe("💬 Написать в WhatsApp");
    expect(chat?.[0]?.url).toContain("https://wa.me/375296053032?text=");
    expect(decodeURIComponent(chat?.[0]?.url ?? "")).toContain(
      "Здравствуйте, Иван! Это ACTIVE SALES — вы оставили заявку на курс «Продажи в аптеке»",
    );
    expect(admin?.[0]?.url).toBe("https://example.by/admin/leads");
  });

  it("Viber открывает через веб-редирект, у Telegram — прямой диалог", () => {
    const viber = leadTelegramButtons({ ...base, contact: "+375296053032", contactType: "VIBER" });
    expect(viber[0]?.[0]?.url).toContain("https://viber.click/375296053032?text=");

    const tg = leadTelegramButtons({ ...base, contact: "@nurlan", contactType: "TELEGRAM" });
    expect(tg[0]?.[0]?.url).toBe("https://t.me/nurlan");
  });

  it("у почты кнопки чата нет — остаётся только админка", () => {
    const rows = leadTelegramButtons({ ...base, contactType: "EMAIL" }, "https://example.by");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.[0]?.text).toBe("🗂 Заявки в админке");
  });
});

describe("leadGreeting", () => {
  it("подстраивается под тип заявки", () => {
    expect(leadGreeting({ ...base, kind: "B2B" })).toContain("корпоративное обучение");
    expect(leadGreeting({ ...base, format: "OFFLINE" })).toContain("офлайн-тренинг");
    expect(leadGreeting(base)).toContain("Здравствуйте! ");
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
      quote: leadQuote({
        kind: "B2B",
        seats: 20,
        selectedCoursesTiyn: [byn(350), byn(250)],
      }),
    });
    expect(text).toContain("Тариф: выбранные курсы");
    expect(text).toContain("× 20 =");
    expect(text).toContain("«Компания», −35%");
  });

  it("предупреждает, когда мест меньше минимального пакета", () => {
    const text = leadTelegramText({
      ...base,
      kind: "B2B",
      seatsWanted: 3,
      quote: leadQuote({ kind: "B2B", seats: 3, selectedCoursesTiyn: [byn(600)] }),
    });
    expect(text).toContain("Мест меньше минимального пакета");
  });

  it("для розницы показывает цену выбранного курса", () => {
    const text = leadTelegramText({
      ...base,
      courseTitle: "Продажи в аптеке",
      quote: leadQuote({ kind: "B2C", courseTiyn: 49000 }),
    });
    // Во время акции в уведомлении стоит цена к оплате и полная — от чего скидка.
    // Ожидание считаем через lib/pricing/promo, чтобы тест пережил её окончание.
    const sale = salePrice(49000);
    expect(text).toContain(`Тариф: курс, ${sale.tiyn / 100}\u00A0бел.\u00A0руб.`);
    if (sale.oldTiyn) {
      expect(text).toContain(`акция −${sale.percent}% от ${sale.oldTiyn / 100}\u00A0бел.\u00A0руб.`);
    }
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

describe("ownerLeadEmail", () => {
  it("пишет канал, страну номера и домен заявки", () => {
    const mail = ownerLeadEmail("owner@example.by", {
      ...base,
      contact: "+77058306028",
      contactType: "WHATSAPP",
      contactCountry: "KZ",
      site: "BY",
      siteHost: "study.activesales.by",
    });
    expect(mail.text).toContain("WhatsApp: +7 705 830 6028");
    expect(mail.text).toContain("Страна номера: 🇰🇿 Казахстан ⚠️");
    expect(mail.text).toContain("Заявка с домена: 🇧🇾 study.activesales.by");
    // Отвечать письмом некуда: контакт — мессенджер, а не почта.
    expect(mail.replyTo).toBeUndefined();
  });

  it("подставляет replyTo, когда контакт — почта", () => {
    const mail = ownerLeadEmail("owner@example.by", {
      ...base,
      contactType: "EMAIL",
      contact: "student@example.com",
    });
    expect(mail.replyTo).toBe("student@example.com");
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
