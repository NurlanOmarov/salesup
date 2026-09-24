import { describe, it, expect } from "vitest";
import { youtubeId, isShortsUrl, parsePromoVideos, promoPosterKey, PROMO_MEDIA_RE } from "./promo-video";

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

  it("свой ролик: id — имя файла, чужие каталоги и расширения отбрасываются", () => {
    expect(
      parsePromoVideos([
        { file: "courses/sales-chem/promo/reel-1.mp4", vertical: true, title: "Воронка" },
        { file: "courses/sales-chem/lessons/abc/master.m3u8" },
        { file: "../etc/passwd" },
        { file: "courses/sales-chem/promo/reel-1.mp4" },
      ]),
    ).toEqual([
      { id: "reel-1", vertical: true, title: "Воронка", file: "courses/sales-chem/promo/reel-1.mp4" },
    ]);
  });
});

describe("свои промо-файлы", () => {
  it("превью лежит рядом с роликом", () => {
    expect(promoPosterKey("courses/x/promo/reel-2.mp4")).toBe("courses/x/promo/reel-2.jpg");
  });

  it("публично отдаются только ролики и превью из каталога promo", () => {
    expect(PROMO_MEDIA_RE.test("courses/x/promo/reel-2.mp4")).toBe(true);
    expect(PROMO_MEDIA_RE.test("courses/x/promo/reel-2.jpg")).toBe(true);
    expect(PROMO_MEDIA_RE.test("courses/x/lessons/abc/720p/seg_000.ts")).toBe(false);
    expect(PROMO_MEDIA_RE.test("courses/x/promo/../lessons/a.mp4")).toBe(false);
  });
});
