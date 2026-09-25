import { describe, it, expect } from "vitest";
import { parsePromoVideos, promoPosterKey, PROMO_MEDIA_RE } from "./promo-video";

describe("parsePromoVideos", () => {
  it("читает список и нормализует поля", () => {
    expect(
      parsePromoVideos([
        { file: "courses/x/promo/promo-1.mp4", vertical: true, title: "  О курсе  " },
        { file: "courses/x/promo/promo-2.mp4" },
      ]),
    ).toEqual([
      { id: "promo-1", vertical: true, title: "О курсе", file: "courses/x/promo/promo-1.mp4" },
      { id: "promo-2", vertical: false, file: "courses/x/promo/promo-2.mp4" },
    ]);
  });

  it("отбрасывает мусор, YouTube-ID без файла и пустое поле", () => {
    expect(parsePromoVideos(null)).toEqual([]);
    expect(parsePromoVideos("8BpOtMv_Qzk")).toEqual([]);
    expect(
      parsePromoVideos([
        null,
        { id: "8BpOtMv_Qzk", vertical: true },
        { file: "courses/x/promo/promo-1.mp4", vertical: true },
      ]),
    ).toEqual([{ id: "promo-1", vertical: true, file: "courses/x/promo/promo-1.mp4" }]);
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
