import { describe, it, expect } from "vitest";
import { formatTimecode } from "./format";

describe("formatTimecode", () => {
  it("форматирует секунды как м:сс", () => {
    expect(formatTimecode(0)).toBe("0:00");
    expect(formatTimecode(5)).toBe("0:05");
    expect(formatTimecode(65)).toBe("1:05");
    expect(formatTimecode(600)).toBe("10:00");
  });

  it("добавляет часы для длинных значений", () => {
    expect(formatTimecode(3600)).toBe("1:00:00");
    expect(formatTimecode(3661)).toBe("1:01:01");
  });

  it("не уходит в минус и округляет вниз", () => {
    expect(formatTimecode(-10)).toBe("0:00");
    expect(formatTimecode(9.9)).toBe("0:09");
  });
});
