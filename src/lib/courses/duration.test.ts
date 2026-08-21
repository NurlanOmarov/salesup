import { describe, it, expect } from "vitest";
import { parseDurationLabel, formatDuration, localizedDuration } from "./duration.js";

describe("parseDurationLabel", () => {
  it("разбирает подписи, которые реально стоят у курсов", () => {
    expect(parseDurationLabel("~5 часов 50 минут")).toBe(350);
    expect(parseDurationLabel("~1 час 9 минут")).toBe(69);
    expect(parseDurationLabel("~2 часа 25 минут")).toBe(145);
    expect(parseDurationLabel("~54 минуты")).toBe(54);
    expect(parseDurationLabel("~41 минута")).toBe(41);
  });

  it("пустое и неразбираемое значение не притворяются нулём", () => {
    expect(parseDurationLabel(null)).toBeNull();
    expect(parseDurationLabel("несколько занятий")).toBeNull();
  });
});

describe("formatDuration", () => {
  it("русские склонения", () => {
    expect(formatDuration(60, "ru")).toBe("~1 час");
    expect(formatDuration(145, "ru")).toBe("~2 часа 25 минут");
    expect(formatDuration(350, "ru")).toBe("~5 часов 50 минут");
    expect(formatDuration(41, "ru")).toBe("~41 минута");
  });

  it("казахский и узбекский — без склонений", () => {
    expect(formatDuration(350, "kk")).toBe("~5 сағат 50 минут");
    expect(formatDuration(69, "uz")).toBe("~1 soat 9 daqiqa");
    expect(formatDuration(38, "kk")).toBe("~38 минут");
    expect(formatDuration(38, "uz")).toBe("~38 daqiqa");
  });
});

describe("localizedDuration", () => {
  it("русская витрина показывает подпись владельца без изменений", () => {
    expect(localizedDuration("~5 часов 50 минут", "ru")).toBe("~5 часов 50 минут");
  });

  it("на другом языке подпись пересобирается", () => {
    expect(localizedDuration("~5 часов 50 минут", "uz")).toBe("~5 soat 50 daqiqa");
  });

  it("неразбираемая подпись остаётся как есть — лучше, чем пусто", () => {
    expect(localizedDuration("два вечера", "kk")).toBe("два вечера");
  });
});
