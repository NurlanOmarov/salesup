import { describe, it, expect } from "vitest";
import { youtubeId, isShortsUrl, parsePromoVideos } from "./promo-video";

describe("youtubeId", () => {
  it("берёт ID из разных форм ссылки", () => {
    expect(youtubeId("https://www.youtube.com/watch?v=OXDSOlTZg_Y")).toBe("OXDSOlTZg_Y");
    expect(youtubeId("https://www.youtube.com/shorts/8BpOtMv_Qzk")).toBe("8BpOtMv_Qzk");
    expect(youtubeId("https://youtu.be/8BpOtMv_Qzk?t=10")).toBe("8BpOtMv_Qzk");
    expect(youtubeId("https://www.youtube.com/embed/8BpOtMv_Qzk")).toBe("8BpOtMv_Qzk");
    expect(youtubeId("  8BpOtMv_Qzk  ")).toBe("8BpOtMv_Qzk");
  });

  it("не выдумывает ID там, где его нет", () => {
    expect(youtubeId("https://activesales.by/product/diy")).toBeNull();
    expect(youtubeId("")).toBeNull();
    expect(youtubeId("short")).toBeNull();
  });
});

describe("isShortsUrl", () => {
  it("узнаёт вертикальный формат по ссылке", () => {
    expect(isShortsUrl("https://www.youtube.com/shorts/8BpOtMv_Qzk")).toBe(true);
    expect(isShortsUrl("https://www.youtube.com/watch?v=OXDSOlTZg_Y")).toBe(false);
  });
});

describe("parsePromoVideos", () => {
  it("читает список и нормализует поля", () => {
    expect(
      parsePromoVideos([
        { id: "8BpOtMv_Qzk", vertical: true, title: "  О курсе  " },
        { id: "OXDSOlTZg_Y" },
      ]),
    ).toEqual([
      { id: "8BpOtMv_Qzk", vertical: true, title: "О курсе" },
      { id: "OXDSOlTZg_Y", vertical: false },
    ]);
  });

  it("отбрасывает мусор, дубли и пустое поле", () => {
    expect(parsePromoVideos(null)).toEqual([]);
    expect(parsePromoVideos("8BpOtMv_Qzk")).toEqual([]);
    expect(
      parsePromoVideos([
        { id: "не-id" },
        null,
        { id: "8BpOtMv_Qzk", vertical: true },
        { id: "8BpOtMv_Qzk", vertical: false },
      ]),
    ).toEqual([{ id: "8BpOtMv_Qzk", vertical: true }]);
  });
});
