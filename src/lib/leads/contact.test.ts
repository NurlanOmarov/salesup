import { describe, expect, it } from "vitest";
import {
  contactLink,
  displayContact,
  isPhoneContact,
  normalizeContact,
  normalizeTelegramUsername,
  webContactLink,
} from "./contact.js";

describe("normalizeContact", () => {
  it("приводит номер мессенджера к E.164 и определяет страну", () => {
    expect(normalizeContact("WHATSAPP", "+375 29 605 30 32")).toEqual({
      value: "+375296053032",
      country: "BY",
    });
    expect(normalizeContact("VIBER", "+375 (29) 605-30-32")).toEqual({
      value: "+375296053032",
      country: "BY",
    });
  });

  it("различает страны внутри кода +7: Казахстан и Россия", () => {
    expect(normalizeContact("WHATSAPP", "+7 705 830 60 28")?.country).toBe("KZ");
    expect(normalizeContact("WHATSAPP", "+7 915 649 96 41")?.country).toBe("RU");
  });

  it("узнаёт номер, записанный без международного кода", () => {
    // Без кода страны WhatsApp номер не находит — поэтому сохраняем только E.164.
    expect(normalizeContact("WHATSAPP", "8 029 605 30 32")).toEqual({
      value: "+375296053032",
      country: "BY",
    });
  });

  it("не подставляет чужую страну вместо выбранной", () => {
    // `303229605` формально годится нескольким странам. Угадывать нельзя: заявка
    // ушла бы с номером страны, которую человек не выбирал (см. lib/phone).
    expect(normalizeContact("WHATSAPP", "303229605")).toBeNull();
  });

  it("не принимает обрывок номера", () => {
    expect(normalizeContact("WHATSAPP", "+375 29")).toBeNull();
    expect(normalizeContact("VIBER", "позвоните мне")).toBeNull();
  });

  it("принимает у Telegram и ник, и номер", () => {
    expect(normalizeContact("TELEGRAM", "https://t.me/nurlan_sales")).toEqual({
      value: "@nurlan_sales",
      country: null,
    });
    expect(normalizeContact("TELEGRAM", "+77058306028")).toEqual({
      value: "+77058306028",
      country: "KZ",
    });
  });

  it("не принимает слишком короткий ник Telegram", () => {
    expect(normalizeContact("TELEGRAM", "@ab")).toBeNull();
  });

  it("приводит почту к нижнему регистру и проверяет её", () => {
    expect(normalizeContact("EMAIL", " Student@Example.COM ")).toEqual({
      value: "student@example.com",
      country: null,
    });
    expect(normalizeContact("EMAIL", "student@example")).toBeNull();
  });

  it("не пропускает номер, подставленный в почтовый канал", () => {
    expect(normalizeContact("EMAIL", "+375296053032")).toBeNull();
  });
});

describe("contactLink", () => {
  it("ведёт в нужный канал", () => {
    expect(contactLink("WHATSAPP", "+375296053032")).toBe("https://wa.me/375296053032");
    expect(contactLink("TELEGRAM", "@nurlan")).toBe("https://t.me/nurlan");
    expect(contactLink("TELEGRAM", "+77058306028")).toBe("https://t.me/+77058306028");
    expect(contactLink("VIBER", "+375296053032")).toBe("viber://chat?number=%2B375296053032");
    expect(contactLink("EMAIL", "a@b.by")).toBe("mailto:a@b.by");
  });

  it("для сообщения бота отдаёт только http-ссылки", () => {
    // Telegram не принимает в разметке схемы вроде viber:// и mailto:.
    expect(webContactLink("WHATSAPP", "+375296053032")).toContain("https://");
    expect(webContactLink("VIBER", "+375296053032")).toBeNull();
    expect(webContactLink("EMAIL", "a@b.by")).toBeNull();
  });
});

describe("displayContact", () => {
  it("разбивает номер на группы, а ник и почту оставляет как есть", () => {
    expect(displayContact("WHATSAPP", "+375296053032")).toBe("+375 29 605 30 32");
    expect(displayContact("TELEGRAM", "@nurlan")).toBe("@nurlan");
    expect(displayContact("EMAIL", "a@b.by")).toBe("a@b.by");
  });
});

describe("isPhoneContact", () => {
  it("телефонным считает только номер", () => {
    expect(isPhoneContact("TELEGRAM", "+77058306028")).toBe(true);
    expect(isPhoneContact("TELEGRAM", "@nurlan")).toBe(false);
    expect(isPhoneContact("EMAIL", "a@b.by")).toBe(false);
  });
});

describe("normalizeTelegramUsername", () => {
  it("вычищает ссылку и собачку", () => {
    expect(normalizeTelegramUsername("https://t.me/@nurlan_sales")).toBe("nurlan_sales");
  });
});
