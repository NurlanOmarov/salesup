import { describe, it, expect } from "vitest";
import { parseArgs, requireOption } from "./args.js";

describe("parseArgs", () => {
  it("позиционные аргументы", () => {
    expect(parseArgs(["a", "b"]).positionals).toEqual(["a", "b"]);
  });

  it("--flag value", () => {
    expect(parseArgs(["--lesson", "abc"]).options).toEqual({ lesson: "abc" });
  });

  it("булев --flag в конце", () => {
    expect(parseArgs(["--force"]).options).toEqual({ force: true });
  });

  it("булев --flag перед другим флагом", () => {
    expect(parseArgs(["--force", "--lesson", "x"]).options).toEqual({
      force: true,
      lesson: "x",
    });
  });

  it("смешанные позиционные и опции", () => {
    const r = parseArgs(["https://url", "--course", "sales-pharma", "--force"]);
    expect(r.positionals).toEqual(["https://url"]);
    expect(r.options).toEqual({ course: "sales-pharma", force: true });
  });
});

describe("requireOption", () => {
  it("возвращает значение", () => {
    expect(requireOption(parseArgs(["--lesson", "x"]), "lesson", "usage")).toBe("x");
  });

  it("бросает при отсутствии", () => {
    expect(() => requireOption(parseArgs([]), "lesson", "usage")).toThrow(/--lesson/);
  });

  it("бросает при булевом значении (флаг без значения)", () => {
    expect(() => requireOption(parseArgs(["--lesson"]), "lesson", "u")).toThrow();
  });
});
