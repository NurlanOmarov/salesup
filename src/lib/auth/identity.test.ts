import { describe, expect, it } from "vitest";
import { displayIdentity, identityWhere, parseIdentity } from "./identity";

describe("parseIdentity", () => {
  it("распознаёт e-mail и приводит к нижнему регистру", () => {
    expect(parseIdentity(" User@Example.BY ")).toEqual({
      kind: "email",
      value: "user@example.by",
    });
  });

  it("распознаёт логин работника организации", () => {
    expect(parseIdentity("Acme-0042")).toEqual({ kind: "login", value: "acme-0042" });
  });

  it("отклоняет мусор", () => {
    expect(parseIdentity("")).toBeNull();
    expect(parseIdentity("   ")).toBeNull();
    expect(parseIdentity("not an email@")).toBeNull();
    expect(parseIdentity("acme 0042")).toBeNull();
    expect(parseIdentity("acme_0042")).toBeNull();
    expect(parseIdentity("-acme")).toBeNull();
  });

  it("строка с @ никогда не трактуется как логин", () => {
    // Иначе можно было бы искать пользователя по login со значением e-mail.
    expect(parseIdentity("a@b")).toBeNull();
  });
});

describe("identityWhere", () => {
  it("ищет по нужной колонке", () => {
    expect(identityWhere({ kind: "email", value: "a@b.by" })).toEqual({
      email: "a@b.by",
    });
    expect(identityWhere({ kind: "login", value: "acme-0001" })).toEqual({
      login: "acme-0001",
    });
  });
});

describe("displayIdentity", () => {
  it("у работника организации показывает логин", () => {
    expect(displayIdentity({ login: "acme-0042", email: null })).toBe("acme-0042");
  });

  it("у розничного ученика — e-mail", () => {
    expect(displayIdentity({ login: null, email: "a@b.by" })).toBe("a@b.by");
  });

  it("без обоих не падает", () => {
    expect(displayIdentity({})).toBe("—");
  });
});
