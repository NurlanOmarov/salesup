import { describe, expect, it } from "vitest";
import { parseChatIds } from "./chat-ids.js";

describe("parseChatIds", () => {
  it("читает один id", () => {
    expect(parseChatIds("77980353")).toEqual(["77980353"]);
  });

  it("читает список через запятую и пробелы", () => {
    expect(parseChatIds("77980353, 12345 ;678")).toEqual(["77980353", "12345", "678"]);
  });

  it("сохраняет минус у групповых чатов", () => {
    expect(parseChatIds("-1001234567890")).toEqual(["-1001234567890"]);
  });

  it("отбрасывает мусор и дубли", () => {
    expect(parseChatIds("77980353,@onb333,,77980353")).toEqual(["77980353"]);
  });

  it("пусто, если переменная не задана", () => {
    expect(parseChatIds(undefined)).toEqual([]);
    expect(parseChatIds("")).toEqual([]);
  });
});
