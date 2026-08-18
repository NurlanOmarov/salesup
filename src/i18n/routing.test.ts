import { describe, it, expect } from "vitest";
import {
  stripLocale,
  localizePath,
  localesForHost,
  hasKazakhVersion,
  isKazakhIndexed,
  KK_PATHS,
  KK_READY,
} from "./routing.js";

describe("stripLocale", () => {
  it("снимает префикс казахского", () => {
    expect(stripLocale("/kk")).toEqual({ locale: "kk", pathname: "/" });
    expect(stripLocale("/kk/courses")).toEqual({ locale: "kk", pathname: "/courses" });
    expect(stripLocale("/kk/courses/spin")).toEqual({ locale: "kk", pathname: "/courses/spin" });
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
  it("казахский предлагается только на казахстанском домене и только когда готов", () => {
    expect(localesForHost("study.activesales.kz")).toEqual(
      KK_READY ? ["ru", "kk"] : ["ru"],
    );
  });

  it("на остальных доменах и без хоста — только русский", () => {
    expect(localesForHost("study.activesales.by")).toEqual(["ru"]);
    expect(localesForHost("study.sales-active.ru")).toEqual(["ru"]);
    expect(localesForHost(null)).toEqual(["ru"]);
  });
});

describe("hasKazakhVersion", () => {
  it("переведённые страницы получают казахскую версию", () => {
    for (const path of KK_PATHS) expect(hasKazakhVersion(path)).toBe(true);
  });

  it("карточка курса открыта: интерфейс казахский, содержимое курса русское", () => {
    expect(hasKazakhVersion("/courses/spin")).toBe(true);
  });

  it("непереведённые разделы уводятся на русскую версию", () => {
    // юридические документы намеренно остаются в русской редакции
    expect(hasKazakhVersion("/offer")).toBe(false);
    expect(hasKazakhVersion("/privacy")).toBe(false);
    expect(hasKazakhVersion("/verify/abc")).toBe(false);
  });
});

describe("isKazakhIndexed", () => {
  it("в hreflang попадают все полностью переведённые страницы", () => {
    for (const path of KK_PATHS) expect(isKazakhIndexed(path)).toBe(true);
  });

  it("страницы со смешанным содержимым в hreflang не идут", () => {
    // название и программа курса приходят из БД на русском
    expect(isKazakhIndexed("/courses/spin")).toBe(false);
    expect(isKazakhIndexed("/offer")).toBe(false);
  });
});
