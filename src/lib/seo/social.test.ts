import { describe, it, expect } from "vitest";
import type { SeoSettings } from "@prisma/client";
import { socialLinks, socialProfiles } from "./social.js";

// Значения по умолчанию из SEO_DEFAULTS: сам модуль настроек server-only,
// поэтому в тесте держим их копию — важна логика сборки, а не источник.
const base = {
  socialInstagram: "https://www.instagram.com/activesales.by/",
  socialTelegram: null,
  socialYoutube: "https://www.youtube.com/channel/UCI9_MiDDbAsfctHtXtsG5Bw",
  socialTiktok: "https://www.tiktok.com/@dubovikvitaliy",
  socialFacebook: "https://www.facebook.com/groups/activesales/",
  socialLinkedin: "https://www.linkedin.com/in/vitaly-dubovik-1ab9204a/",
  socialVk: "https://vk.com/activesalesby",
} as SeoSettings;

describe("socialLinks (sameAs в разметке организации)", () => {
  it("собирает все заполненные профили", () => {
    const links = socialLinks(base);
    expect(links).toContain("https://www.instagram.com/activesales.by/");
    expect(links).toContain("https://vk.com/activesalesby");
    expect(links).toContain("https://www.linkedin.com/in/vitaly-dubovik-1ab9204a/");
  });

  it("пустые поля не попадают в sameAs — пустая строка ломает разметку", () => {
    const links = socialLinks({ ...base, socialVk: null, socialFacebook: "" } as SeoSettings);
    expect(links).not.toContain("");
    expect(links.some((l) => l.includes("vk.com"))).toBe(false);
  });
});

describe("socialProfiles (значки в футере)", () => {
  it("каждый профиль знает свой значок и подпись", () => {
    const icons = socialProfiles(base).map((p) => p.icon);
    expect(icons).toEqual(["instagram", "youtube", "facebook", "vk", "tiktok", "linkedin"]);
  });

  it("незаполненная сеть не рисует значок-заглушку", () => {
    const profiles = socialProfiles({ ...base, socialTiktok: null } as SeoSettings);
    expect(profiles.map((p) => p.icon)).not.toContain("tiktok");
  });
});

describe("externalRatings (блок доверия)", () => {
  it("площадка без оценки не показывается — выдуманных цифр на витрине быть не может", async () => {
    const { externalRatings } = await import("./ratings.js");
    const items = externalRatings({
      yandexMapsUrl: "https://yandex.by/maps/org/1",
      yandexRating: 4.7,
      yandexReviews: 42,
      googleMapsUrl: "https://maps.google.com/?q=1",
      googleRating: null,
      googleReviews: null,
    } as never);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ source: "yandex", rating: 4.7, reviews: 42 });
  });

  it("оценка без ссылки тоже не показывается — читателю некуда пойти проверить", async () => {
    const { externalRatings } = await import("./ratings.js");
    const items = externalRatings({ yandexMapsUrl: null, yandexRating: 4.7 } as never);
    expect(items).toHaveLength(0);
  });
});
