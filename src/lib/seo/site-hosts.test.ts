import { describe, it, expect } from "vitest";
import { SITE_HOSTS, DEFAULT_SITE, matchSiteHost, alternatesFor } from "./site-hosts.js";
import { KK_READY } from "@/i18n/routing";

describe("matchSiteHost", () => {
  it("узнаёт свои домены с портом, регистром и списком через запятую", () => {
    expect(matchSiteHost("study.activesales.kz")?.code).toBe("KZ");
    expect(matchSiteHost("STUDY.SALES-ACTIVE.RU")?.code).toBe("RU");
    expect(matchSiteHost("study.activesales.by:443")?.code).toBe("BY");
    // X-Forwarded-Host от цепочки прокси может прийти списком
    expect(matchSiteHost("study.activesales.kz, 192.168.122.10")?.code).toBe("KZ");
  });

  it("чужой хост и пустое значение → null (сработает фолбэк на канонический домен)", () => {
    expect(matchSiteHost("activesales.kz")).toBeNull(); // корень зоны — чужой сайт
    expect(matchSiteHost("localhost")).toBeNull();
    expect(matchSiteHost(null)).toBeNull();
    expect(matchSiteHost("")).toBeNull();
  });
});

describe("alternatesFor", () => {
  it("self-canonical остаётся относительным — его разворачивает metadataBase домена", () => {
    expect(alternatesFor("/courses")?.canonical).toBe("/courses");
  });

  it("hreflang перечисляет все домены и включает саму страницу (взаимные ссылки)", () => {
    const langs = alternatesFor("/courses")!.languages as Record<string, string>;
    expect(langs["ru-BY"]).toBe("https://study.activesales.by/courses");
    expect(langs["ru-KZ"]).toBe("https://study.activesales.kz/courses");
    expect(langs["ru-RU"]).toBe("https://study.sales-active.ru/courses");
    // + x-default (kk-KZ появляется только при KK_READY)
    expect(Object.keys(langs)).toHaveLength(SITE_HOSTS.length + (KK_READY ? 2 : 1));
  });

  it("казахская версия попадает в hreflang только когда переводы готовы", () => {
    const langs = alternatesFor("/courses")!.languages as Record<string, string>;
    expect(langs["kk-KZ"]).toBe(
      KK_READY ? "https://study.activesales.kz/kk/courses" : undefined,
    );
  });

  it("на казахской странице canonical ведёт на неё саму, а не на русскую", () => {
    expect(alternatesFor("/courses", "kk")?.canonical).toBe("/kk/courses");
    expect(alternatesFor("/", "kk")?.canonical).toBe("/kk");
  });

  it("x-default ведёт на канонический домен", () => {
    const langs = alternatesFor("/")!.languages as Record<string, string>;
    expect(langs["x-default"]).toBe(`https://${DEFAULT_SITE.host}`);
  });

  it("главная не превращается в двойной слэш", () => {
    const langs = alternatesFor("/")!.languages as Record<string, string>;
    for (const url of Object.values(langs)) expect(url).not.toMatch(/\/$/);
  });
});
