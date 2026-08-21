import { describe, expect, it } from "vitest";
import {
  buildIcs,
  formatInZone,
  overlaps,
  utcToZonedInput,
  zonedInputToUtc,
  zoneLabel,
} from "./format";

describe("часовые пояса встреч", () => {
  it("14:00 в Минске — это 11:00 UTC", () => {
    const utc = zonedInputToUtc("2026-09-10T14:00", "Europe/Minsk");
    expect(utc.toISOString()).toBe("2026-09-10T11:00:00.000Z");
  });

  it("14:00 в Ташкенте — это 09:00 UTC (рынки разнесены на два часа)", () => {
    const utc = zonedInputToUtc("2026-09-10T14:00", "Asia/Tashkent");
    expect(utc.toISOString()).toBe("2026-09-10T09:00:00.000Z");
  });

  it("перевод в зону и обратно возвращает исходное значение формы", () => {
    for (const tz of ["Europe/Minsk", "Asia/Almaty", "Europe/Moscow"]) {
      const local = "2026-12-31T23:30";
      expect(utcToZonedInput(zonedInputToUtc(local, tz), tz)).toBe(local);
    }
  });

  it("полночь не превращается в 24:00", () => {
    const utc = zonedInputToUtc("2026-09-10T00:00", "Asia/Almaty");
    expect(utcToZonedInput(utc, "Asia/Almaty")).toBe("2026-09-10T00:00");
  });

  it("показывает время в зоне компании, а не сервера", () => {
    const utc = new Date("2026-09-10T11:00:00.000Z");
    expect(formatInZone(utc, "Europe/Minsk")).toContain("14:00");
    expect(formatInZone(utc, "Asia/Almaty")).toContain("16:00");
  });

  it("подписывает зону человеческим названием", () => {
    expect(zoneLabel("Asia/Tashkent")).toBe("Ташкент");
    expect(zoneLabel("Europe/Kyiv")).toBe("Europe/Kyiv");
  });

  it("некорректный ввод отвергается, а не даёт Invalid Date", () => {
    expect(() => zonedInputToUtc("", "Europe/Minsk")).toThrow();
    expect(() => zonedInputToUtc("2026-09-10", "Europe/Minsk")).toThrow();
  });
});

describe("календарный файл", () => {
  const session = {
    id: "sess1",
    title: "Вводная сессия; отдел продаж",
    scheduledAt: new Date("2026-09-10T11:00:00.000Z"),
    durationMin: 60,
    joinUrl: "https://sabak.kz/m/abc",
  };

  it("содержит начало, конец и ссылку", () => {
    const ics = buildIcs(session);
    expect(ics).toContain("DTSTART:20260910T110000Z");
    expect(ics).toContain("DTEND:20260910T120000Z");
    expect(ics).toContain("URL:https://sabak.kz/m/abc");
  });

  it("экранирует точку с запятой в названии — иначе календарь читает мусор", () => {
    expect(buildIcs(session)).toContain("SUMMARY:Вводная сессия\\; отдел продаж");
  });

  it("строки разделены CRLF: Apple и Outlook иначе не открывают файл", () => {
    expect(buildIcs(session).split("\r\n").length).toBeGreaterThan(10);
  });

  it("без ссылки файл всё равно валиден", () => {
    const ics = buildIcs({ ...session, joinUrl: null });
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).not.toContain("URL:");
  });
});

describe("занятость слота тренера", () => {
  const at = (iso: string) => new Date(iso);

  it("накладывающиеся встречи считаются конфликтом", () => {
    expect(
      overlaps(at("2026-09-10T11:00:00Z"), 60, at("2026-09-10T11:30:00Z"), 60),
    ).toBe(true);
  });

  it("встык — не конфликт: 14:00–15:00 и 15:00–16:00 уживаются", () => {
    expect(
      overlaps(at("2026-09-10T11:00:00Z"), 60, at("2026-09-10T12:00:00Z"), 60),
    ).toBe(false);
  });

  it("длинная встреча накрывает короткую внутри себя", () => {
    expect(
      overlaps(at("2026-09-10T11:00:00Z"), 180, at("2026-09-10T12:00:00Z"), 30),
    ).toBe(true);
  });

  it("разные дни не пересекаются", () => {
    expect(
      overlaps(at("2026-09-10T11:00:00Z"), 60, at("2026-09-11T11:00:00Z"), 60),
    ).toBe(false);
  });
});
