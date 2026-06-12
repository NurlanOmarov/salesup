import { describe, it, expect } from "vitest";
import { courseProgress, nextLesson } from "./progress.js";

const L = (id: string, completed: boolean) => ({ id, completed });

describe("courseProgress", () => {
  it("пустой курс → 0/0, 0%", () => {
    expect(courseProgress([])).toEqual({ total: 0, completed: 0, percent: 0 });
  });

  it("половина пройдена → 50%", () => {
    expect(courseProgress([L("a", true), L("b", false)])).toEqual({
      total: 2,
      completed: 1,
      percent: 50,
    });
  });

  it("процент округляется вниз", () => {
    // 1 из 3 = 33.33 → 33
    expect(courseProgress([L("a", true), L("b", false), L("c", false)]).percent).toBe(33);
  });

  it("всё пройдено → 100%", () => {
    expect(courseProgress([L("a", true), L("b", true)]).percent).toBe(100);
  });
});

describe("nextLesson", () => {
  it("первый непройденный", () => {
    expect(nextLesson([L("a", true), L("b", false), L("c", false)])?.id).toBe("b");
  });

  it("всё пройдено → первый урок (для повтора)", () => {
    expect(nextLesson([L("a", true), L("b", true)])?.id).toBe("a");
  });

  it("пустой список → null", () => {
    expect(nextLesson([])).toBeNull();
  });

  it("ничего не пройдено → первый", () => {
    expect(nextLesson([L("a", false), L("b", false)])?.id).toBe("a");
  });
});
