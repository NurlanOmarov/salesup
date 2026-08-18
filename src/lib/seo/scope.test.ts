import { describe, it, expect } from "vitest";
import { scopeChain, applyOverride, isKnownScope, SEO_SCOPES } from "./scope.js";

describe("scopeChain", () => {
  it("русская версия домена наследуется от общих настроек", () => {
    expect(scopeChain("KZ")).toEqual(["KZ", "global"]);
    expect(scopeChain("RU")).toEqual(["RU", "global"]);
  });

  it("казахская версия наследуется от казахстанского домена, затем от общих", () => {
    expect(scopeChain("KZ", "kk")).toEqual(["KZ-kk", "KZ", "global"]);
  });

  it("неизвестный домен откатывается на канонический", () => {
    expect(scopeChain("XX")).toEqual(["BY", "global"]);
  });
});

describe("applyOverride", () => {
  const base: { defaultTitle: string | null; yandexVerification: string | null; orgPhone: string } = {
    defaultTitle: "Курсы по продажам",
    yandexVerification: null,
    orgPhone: "+375",
  };

  it("непустые поля перекрывают базовые", () => {
    const r = applyOverride(base, { orgPhone: "+7 700", yandexVerification: "abc" });
    expect(r.orgPhone).toBe("+7 700");
    expect(r.yandexVerification).toBe("abc");
    expect(r.defaultTitle).toBe("Курсы по продажам"); // не трогали — наследуется
  });

  it("пустые значения не затирают базовые — это и есть наследование", () => {
    const r = applyOverride(base, { orgPhone: "", defaultTitle: null });
    expect(r.orgPhone).toBe("+375");
    expect(r.defaultTitle).toBe("Курсы по продажам");
  });

  it("служебные поля записи не протекают в результат", () => {
    const r = applyOverride(base, { id: "x", scope: "KZ" }) as Record<string, unknown>;
    expect(r.id).toBeUndefined();
    expect(r.scope).toBeUndefined();
  });
});

describe("SEO_SCOPES", () => {
  it("содержит общий вариант, три домена и казахскую версию", () => {
    expect(SEO_SCOPES.map((s) => s.scope)).toEqual(["global", "BY", "KZ", "RU", "KZ-kk"]);
    expect(isKnownScope("KZ-kk")).toBe(true);
    expect(isKnownScope("UZ")).toBe(false);
  });
});
