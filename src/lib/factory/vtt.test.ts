import { describe, it, expect } from "vitest";
import { parseTimestamp, parseVtt, cuesToRawText, fmtTimecode } from "./vtt.js";

describe("parseTimestamp", () => {
  it("часы:минуты:секунды", () => {
    expect(parseTimestamp("01:02:03.500")).toBeCloseTo(3723.5);
  });
  it("минуты:секунды", () => {
    expect(parseTimestamp("02:03.000")).toBe(123);
  });
  it("запятая как разделитель дробной части", () => {
    expect(parseTimestamp("00:00:05,250")).toBeCloseTo(5.25);
  });
});

const VTT = `WEBVTT

00:00:00.000 --> 00:00:02.000
Здравствуйте, коллеги

00:00:02.000 --> 00:00:04.000
Здравствуйте, коллеги
сегодня поговорим о продажах

00:00:04.000 --> 00:00:06.000
сегодня поговорим о продажах
и работе с возражениями`;

describe("parseVtt", () => {
  it("извлекает реплики с таймкодами", () => {
    const cues = parseVtt(VTT);
    expect(cues.length).toBeGreaterThan(0);
    expect(cues[0]).toEqual({ startSec: 0, text: "Здравствуйте, коллеги" });
  });

  it("дедуплицирует полностью повторяющиеся реплики", () => {
    const cues = parseVtt(VTT);
    const texts = cues.map((c) => c.text);
    // подряд идущие одинаковые строки схлопнуты
    for (let i = 1; i < texts.length; i++) {
      expect(texts[i]).not.toBe(texts[i - 1]);
    }
  });

  it("снимает инлайновые теги", () => {
    const vtt = `WEBVTT

00:00:01.000 --> 00:00:02.000
<c>Привет</c> <00:00:01.500>мир`;
    expect(parseVtt(vtt)[0]?.text).toBe("Привет мир");
  });

  it("пустой VTT → пустой массив", () => {
    expect(parseVtt("WEBVTT\n\n")).toEqual([]);
  });
});

describe("cuesToRawText", () => {
  it("склеивает уникальные реплики в сплошной текст", () => {
    const text = cuesToRawText(parseVtt(VTT));
    expect(text).toContain("Здравствуйте, коллеги");
    expect(text).toContain("работе с возражениями");
    // без дублей
    expect(text.match(/Здравствуйте, коллеги/g)?.length).toBe(1);
  });
});

describe("fmtTimecode", () => {
  it("форматирует mm:ss", () => {
    expect(fmtTimecode(0)).toBe("0:00");
    expect(fmtTimecode(75)).toBe("1:15");
    expect(fmtTimecode(605)).toBe("10:05");
  });
});
