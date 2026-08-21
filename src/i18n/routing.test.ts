import { describe, it, expect } from "vitest";
import {
  stripLocale,
  localizePath,
  localesForHost,
  hasLocaleVersion,
  isLocaleIndexed,
  hostForLocale,
  TRANSLATED_PATHS,
} from "./routing.js";

describe("stripLocale", () => {
  it("снимает префикс языка", () => {
    expect(stripLocale("/kk")).toEqual({ locale: "kk", pathname: "/" });
    expect(stripLocale("/kk/courses")).toEqual({ locale: "kk", pathname: "/courses" });
    expect(stripLocale("/kk/courses/spin")).toEqual({ locale: "kk", pathname: "/courses/spin" });
    expect(stripLocale("/uz/business")).toEqual({ locale: "uz", pathname: "/business" });
  });

  it("русские пути остаются без изменений", () => {
    expect(stripLocale("/courses")).toEqual({ locale: null, pathname: "/courses" });
    expect(stripLocale("/")).toEqual({ locale: null, pathname: "/" });
  });

  it("не путает префикс с похожим сегментом", () => {
    // курс со slug, начинающимся на kk, не должен считаться казахской версией
    expect(stripLocale("/courses/kkk")).toEqual({ locale: null, pathname: "/courses/kkk" });
    expect(stripLocale("/kkk")).toEqual({ locale: null, pathname: "/kkk" });
  });
});

describe("localizePath", () => {
  it("русский — без префикса, казахский — с префиксом", () => {
    expect(localizePath("/courses", "ru")).toBe("/courses");
    expect(localizePath("/courses", "kk")).toBe("/kk/courses");
    expect(localizePath("/", "kk")).toBe("/kk");
  });

  it("не удваивает префикс", () => {
    expect(localizePath("/kk/courses", "kk")).toBe("/kk/courses");
    expect(localizePath("/kk/courses", "ru")).toBe("/courses");
  });
});

describe("localesForHost", () => {
  it("язык предлагается только на своём домене", () => {
    expect(localesForHost("study.activesales.kz")).toEqual(["ru", "kk"]);
    expect(localesForHost("study.activesales.uz")).toEqual(["ru", "uz"]);
  });

  it("на доменах без второго языка и без хоста — только русский", () => {
    expect(localesForHost("study.activesales.by")).toEqual(["ru"]);
    expect(localesForHost("study.sales-active.ru")).toEqual(["ru"]);
    expect(localesForHost(null)).toEqual(["ru"]);
  });

  it("каждый язык знает свой домен", () => {
    expect(hostForLocale("kk")).toBe("study.activesales.kz");
    expect(hostForLocale("uz")).toBe("study.activesales.uz");
  });
});

describe("hasLocaleVersion", () => {
  it("переведённые страницы получают локальную версию", () => {
    for (const locale of ["kk", "uz"] as const) {
      for (const path of TRANSLATED_PATHS[locale]) {
        expect(hasLocaleVersion(path, locale)).toBe(true);
      }
    }
  });

  it("карточка курса открыта: интерфейс локальный, содержимое курса русское", () => {
    expect(hasLocaleVersion("/courses/spin", "kk")).toBe(true);
    expect(hasLocaleVersion("/courses/spin", "uz")).toBe(true);
  });

  it("непереведённые разделы уводятся на русскую версию", () => {
    // юридические документы намеренно остаются в русской редакции
    expect(hasLocaleVersion("/offer", "kk")).toBe(false);
    expect(hasLocaleVersion("/privacy", "uz")).toBe(false);
    expect(hasLocaleVersion("/verify/abc", "kk")).toBe(false);
  });
});

describe("isLocaleIndexed", () => {
  it("в hreflang попадают все полностью переведённые страницы", () => {
    for (const locale of ["kk", "uz"] as const) {
      for (const path of TRANSLATED_PATHS[locale]) {
        expect(isLocaleIndexed(path, locale)).toBe(true);
      }
    }
  });

  it("страницы со смешанным содержимым в hreflang не идут", () => {
    // название и программа курса приходят из БД на русском
    expect(isLocaleIndexed("/courses/spin", "kk")).toBe(false);
    expect(isLocaleIndexed("/offer", "uz")).toBe(false);
  });
});
