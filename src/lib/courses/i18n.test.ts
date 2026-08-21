import { describe, it, expect } from "vitest";
import { localizedCourse, localizedCard, isCourseTranslated, translatedLocales } from "./i18n.js";

const course = {
  title: "Техники продаж в туризме",
  subtitle: "От звонка до поездки",
  description: "Полное описание курса",
  seoTitle: null,
  seoDescription: null,
  translations: [
    {
      locale: "kk",
      title: "Туризмдегі сату техникалары",
      subtitle: null, // подзаголовок не переведён
      description: "Курстың толық сипаттамасы",
      seoTitle: null,
      seoDescription: null,
    },
  ],
};

describe("localizedCourse", () => {
  it("подставляет перевод на языке страницы", () => {
    expect(localizedCourse(course, "kk").title).toBe("Туризмдегі сату техникалары");
  });

  it("непереведённое поле наследует русский текст, а не пустеет", () => {
    expect(localizedCourse(course, "kk").subtitle).toBe("От звонка до поездки");
  });

  it("русская витрина и язык без перевода отдают исходные тексты", () => {
    expect(localizedCourse(course, "ru").title).toBe("Техники продаж в туризме");
    expect(localizedCourse(course, "uz").title).toBe("Техники продаж в туризме");
  });
});

describe("localizedCard", () => {
  it("для каталога берёт только название и подзаголовок", () => {
    expect(localizedCard(course, "kk")).toEqual({
      title: "Туризмдегі сату техникалары",
      subtitle: "От звонка до поездки",
    });
  });
});

describe("isCourseTranslated / translatedLocales", () => {
  it("для индексации нужны и название, и описание", () => {
    expect(isCourseTranslated(course.translations, "kk")).toBe(true);
    expect(translatedLocales(course.translations)).toEqual(["kk"]);
  });

  it("перевод без описания в индекс не идёт — страница осталась бы русской", () => {
    const partial = [{ ...course.translations[0]!, description: null }];
    expect(isCourseTranslated(partial, "kk")).toBe(false);
    expect(translatedLocales(partial)).toEqual([]);
  });
});
